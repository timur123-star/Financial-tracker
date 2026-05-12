import http from 'node:http';
import { log } from './logger.js';
import { pool } from './db.js';
import { getRedis } from './redis.js';
import { renderMetrics, metrics } from './metrics.js';
import { config } from './config.js';
import type { Telegraf } from 'telegraf';

interface ServerOpts {
  port: number;
  host: string;
  /** Optional bot — if provided, the server accepts Telegram webhook updates. */
  bot?: Telegraf;
}

/**
 * Shared HTTP server for `/healthz`, `/readyz`, `/metrics` and (optionally) the
 * Telegram webhook. Keeping all of these on a single port makes platforms like
 * Railway / Fly painless to configure and avoids a second listener.
 */
export function startHttpServer(opts: ServerOpts): http.Server {
  const server = http.createServer((req, res) => {
    handleRequest(req, res, opts).catch((err) => {
      log.error('http handler failed', err);
      metrics.errors.inc({ component: 'http' });
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain' });
      }
      res.end('internal error');
    });
  });

  server.listen(opts.port, opts.host, () => {
    log.info(
      `http server listening on ${opts.host}:${opts.port} (` +
        `health=on, metrics=${config.metricsEnabled ? 'on' : 'off'}, ` +
        `webhook=${opts.bot ? config.webhookPath : 'off'})`,
    );
  });

  return server;
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: ServerOpts,
): Promise<void> {
  const url = req.url ?? '/';
  // Strip query string for routing.
  const path = url.split('?')[0];

  if (path === '/healthz' || path === '/') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  if (path === '/readyz') {
    try {
      await pool.query('SELECT 1');
      const r = await getRedis();
      await r.ping();
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ready');
    } catch (err) {
      log.warn('readyz check failed', err);
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not ready');
    }
    return;
  }

  if (path === '/metrics') {
    if (!config.metricsEnabled) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('disabled');
      return;
    }
    res.writeHead(200, {
      // Prometheus expects this exact content-type for text exposition.
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
    });
    res.end(renderMetrics());
    return;
  }

  if (opts.bot && req.method === 'POST' && path === config.webhookPath) {
    await handleWebhook(req, res, opts.bot);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
}

async function handleWebhook(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  bot: Telegraf,
): Promise<void> {
  // Verify Telegram secret token first — Telegram includes it in this header
  // for every webhook delivery. If we set a token via `setWebhook(secret_token=…)`
  // and the incoming request doesn't have it, the request didn't come from
  // Telegram and we drop it.
  if (config.webhookSecretToken) {
    const headerToken =
      (req.headers['x-telegram-bot-api-secret-token'] as string | undefined) ?? '';
    if (headerToken !== config.webhookSecretToken) {
      log.warn('rejected webhook with wrong secret token');
      metrics.errors.inc({ component: 'webhook-auth' });
      res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('unauthorized');
      return;
    }
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  let update: unknown;
  try {
    update = JSON.parse(raw);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('bad json');
    return;
  }

  // Telegraf accepts the parsed update via `handleUpdate`. We reply 200
  // immediately; Telegram retries on non-2xx.
  try {
    await bot.handleUpdate(update as Parameters<Telegraf['handleUpdate']>[0]);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
  } catch (err) {
    log.error('webhook handler failed', err);
    metrics.errors.inc({ component: 'webhook' });
    // Still return 200 so Telegram doesn't retry storms.
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
  }
}

/** Back-compat shim — keep the old name working. */
export function startHealthServer(port: number): http.Server {
  return startHttpServer({ port, host: config.healthHost });
}
