import type { Telegraf, Context } from 'telegraf';
import { buildStats, type StatsPeriod } from '../services/reports.js';
import { statsPeriodKeyboard } from '../keyboards.js';
import { log } from '../../logger.js';

export async function sendStats(ctx: Context, period: StatsPeriod = 'month'): Promise<void> {
  if (!ctx.from) return;
  const { caption } = await buildStats(ctx.from.id, period);
  const opts = { parse_mode: 'HTML' as const, ...statsPeriodKeyboard(period) };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(caption, opts);
      return;
    } catch (err) {
      log.debug('stats edit failed; sending fresh', err);
    }
  }
  await ctx.reply(caption, opts);
}

export function registerStats(bot: Telegraf): void {
  bot.command('stats', (ctx) => sendStats(ctx, 'month'));
  bot.action(/^stats:(week|month|quarter|year)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const period = ctx.match[1] as StatsPeriod;
    await sendStats(ctx, period);
  });
}
