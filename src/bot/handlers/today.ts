import type { Telegraf, Context } from 'telegraf';
import { buildDayReport } from '../services/reports.js';
import { periodNavKeyboard } from '../keyboards.js';
import { log } from '../../logger.js';

export async function sendToday(ctx: Context, offset = 0): Promise<void> {
  if (!ctx.from) return;
  const report = await buildDayReport(ctx.from.id, offset);
  const opts = {
    parse_mode: 'HTML' as const,
    ...periodNavKeyboard('today', offset),
  };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(report.caption, opts);
      return;
    } catch (err) {
      log.debug('today edit failed; sending fresh', err);
    }
  }
  await ctx.reply(report.caption, opts);
}

export function registerToday(bot: Telegraf): void {
  bot.command('today', (ctx) => sendToday(ctx, 0));
}
