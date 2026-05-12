import { buildBot, setBotCommands } from './bot/index.js';
import { runMigrations, closeDb } from './db.js';
import { closeRedis, getRedis } from './redis.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import { config } from './config.js';
import { log } from './logger.js';
import { startHttpServer } from './health.js';

async function main(): Promise<void> {
  log.info('Personal Financial Tracker bot starting…');

  await runMigrations();
  log.info('migrations applied');

  await getRedis(); // smoke test redis connection

  const bot = buildBot();
  startScheduler(bot);

  // The HTTP server hosts /healthz /readyz /metrics, and — in webhook mode —
  // the Telegram webhook receiver on `config.webhookPath`.
  const httpServer = startHttpServer({
    port: config.healthPort,
    host: config.healthHost,
    bot: config.hasWebhook ? bot : undefined,
  });

  await setBotCommands(bot).catch((err) => log.warn('setMyCommands failed (non-fatal)', err));

  const stop = async (signal: string) => {
    log.info(`received ${signal}, shutting down…`);
    try {
      bot.stop(signal);
    } catch (err) {
      log.warn('bot.stop failed', err);
    }
    stopScheduler();
    httpServer.close();
    if (config.hasWebhook) {
      // Politely tell Telegram to stop hammering our endpoint while we are
      // shutting down. If this fails (network blip), we still exit.
      await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
    }
    await closeRedis().catch(() => {});
    await closeDb().catch(() => {});
    process.exit(0);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));

  if (config.hasWebhook) {
    // Webhook mode: register the URL + secret with Telegram, then idle. The
    // HTTP server above handles inbound updates.
    const url = config.webhookUrl.endsWith('/')
      ? config.webhookUrl.slice(0, -1) + config.webhookPath
      : config.webhookUrl + config.webhookPath;
    await bot.telegram.setWebhook(url, {
      secret_token: config.webhookSecretToken || undefined,
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query', 'edited_message'],
    });
    log.info(
      `bot launched via webhook → ${url} ` +
        `(groq=${config.hasGroq() ? 'on' : 'off'}, tz=${config.defaultTz}, ` +
        `cron=${config.disableCron ? 'off' : 'on'})`,
    );
  } else {
    // Long polling: make sure no leftover webhook is still set, then start.
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    log.info(
      `launching bot polling (groq=${config.hasGroq() ? 'on' : 'off'}, ` +
        `tz=${config.defaultTz}, cron=${config.disableCron ? 'off' : 'on'})`,
    );
    await bot.launch({ dropPendingUpdates: true });
  }
}

main().catch((err) => {
  log.error('fatal startup error', err);
  process.exit(1);
});
