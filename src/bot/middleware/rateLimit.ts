import type { Context, MiddlewareFn } from 'telegraf';
import { getRedis } from '../../redis.js';
import { log } from '../../logger.js';
import { metrics } from '../../metrics.js';

export interface RateLimitOptions {
  windowSeconds: number;
  max: number;
}

/**
 * Per-user sliding-window rate limiter, backed by a Redis INCR counter with a TTL
 * equal to the window. On overflow, the next event is silently dropped — except
 * once per window we send a friendly "слишком быстро" reply so the user knows.
 */
export function rateLimit(
  opts: RateLimitOptions = { windowSeconds: 60, max: 30 },
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();
    try {
      const r = await getRedis();
      const winKey = `rl:${userId}:${Math.floor(Date.now() / (opts.windowSeconds * 1000))}`;
      const count = await r.incr(winKey);
      if (count === 1) await r.expire(winKey, opts.windowSeconds);
      if (count > opts.max) {
        metrics.rateLimitDrops.inc();
        if (count === opts.max + 1) {
          await ctx.reply('🚦 Слишком быстро. Подожди немного и попробуй снова.').catch(() => {});
        }
        return; // drop
      }
    } catch (err) {
      // If Redis is down we don't want to break the bot — just let traffic through.
      log.debug('rate-limit redis error', err);
    }
    return next();
  };
}
