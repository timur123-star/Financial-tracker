import type { Telegraf, Context } from 'telegraf';
import { Input } from 'telegraf';
import { buildMonthReport } from '../services/reports.js';
import { periodNavKeyboard } from '../keyboards.js';

export async function sendMonth(ctx: Context, offset = 0): Promise<void> {
  if (!ctx.from) return;
  const report = await buildMonthReport(ctx.from.id, offset);
  const kb = periodNavKeyboard('month', offset);
  if (report.photo) {
    await ctx.replyWithPhoto(Input.fromBuffer(report.photo), {
      caption: report.caption,
      parse_mode: 'HTML',
      ...kb,
    });
  } else {
    await ctx.reply(report.caption, { parse_mode: 'HTML', ...kb });
  }
}

export function registerMonth(bot: Telegraf): void {
  bot.command('month', (ctx) => sendMonth(ctx, 0));
}
