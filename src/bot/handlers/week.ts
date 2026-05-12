import type { Telegraf, Context } from 'telegraf';
import { Input } from 'telegraf';
import { buildWeekReport, buildWeekBarChart } from '../services/reports.js';
import { periodNavKeyboard } from '../keyboards.js';

export async function sendWeek(ctx: Context, offset = 0): Promise<void> {
  if (!ctx.from) return;
  const report = await buildWeekReport(ctx.from.id, offset);
  const kb = periodNavKeyboard('week', offset);
  if (report.photo) {
    await ctx.replyWithPhoto(Input.fromBuffer(report.photo), {
      caption: report.caption,
      parse_mode: 'HTML',
      ...kb,
    });
    const bar = await buildWeekBarChart(ctx.from.id, offset);
    if (bar) {
      await ctx.replyWithPhoto(Input.fromBuffer(bar), {
        caption: '📅 <b>Динамика по дням недели</b>',
        parse_mode: 'HTML',
      });
    }
  } else {
    await ctx.reply(report.caption, { parse_mode: 'HTML', ...kb });
  }
}

export function registerWeek(bot: Telegraf): void {
  bot.command('week', (ctx) => sendWeek(ctx, 0));
}
