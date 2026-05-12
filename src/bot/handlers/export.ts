import type { Telegraf, Context } from 'telegraf';
import { Input } from 'telegraf';
import { transactionsForExport } from '../../transactions.js';
import { getOrCreateUser } from '../../users.js';
import {
  formatLocalDateTime,
  nextMonth,
  nextQuarter,
  nextWeek,
  nextYear,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from '../../time.js';
import { kopecksToRubles } from '../../format.js';
import { backToMenuKeyboard } from '../keyboards.js';

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export type ExportPeriod = 'week' | 'month' | 'quarter' | 'year' | 'all';

function rangeFor(tz: string, period: ExportPeriod): { from: Date; to: Date; suffix: string } {
  if (period === 'week') {
    const from = startOfWeek(tz);
    const to = nextWeek(from);
    return { from, to, suffix: 'week' };
  }
  if (period === 'quarter') {
    const from = startOfQuarter(tz);
    const to = nextQuarter(tz, from);
    return { from, to, suffix: 'quarter' };
  }
  if (period === 'year') {
    const from = startOfYear(tz);
    const to = nextYear(tz, from);
    return { from, to, suffix: 'year' };
  }
  if (period === 'all') {
    return { from: new Date(0), to: new Date(), suffix: 'all' };
  }
  const from = startOfMonth(tz);
  const to = nextMonth(tz, from);
  return { from, to, suffix: 'month' };
}

export async function sendExportPeriod(ctx: Context, period: ExportPeriod): Promise<void> {
  if (!ctx.from) return;
  const user = await getOrCreateUser(ctx.from.id);
  const { from, to, suffix } = rangeFor(user.tz, period);
  const rows = await transactionsForExport(ctx.from.id, from, to);

  if (rows.length === 0) {
    await ctx.reply(
      '📭 В этом периоде транзакций нет — экспортировать нечего.',
      backToMenuKeyboard(),
    );
    return;
  }

  const header = [
    'id',
    'datetime_local',
    'type',
    'category',
    'amount',
    'currency',
    'note',
    'raw_text',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        csvEscape(formatLocalDateTime(user.tz, new Date(r.created_at))),
        r.type,
        csvEscape(r.category),
        kopecksToRubles(r.amount).toFixed(2),
        user.currency,
        csvEscape(r.note),
        csvEscape(r.raw_text),
      ].join(','),
    );
  }
  const csv = '\uFEFF' + lines.join('\n'); // BOM for Excel
  const buf = Buffer.from(csv, 'utf8');
  const date = new Date();
  const name = `finance-${suffix}-${date.toISOString().slice(0, 10)}.csv`;
  await ctx.replyWithDocument(Input.fromBuffer(buf, name), {
    caption: `📂 Транзакции: ${rows.length} записей · период «${suffix}»`,
    ...backToMenuKeyboard(),
  });
}

export async function sendExport(ctx: Context): Promise<void> {
  await sendExportPeriod(ctx, 'month');
}

export function registerExport(bot: Telegraf): void {
  bot.command('export', sendExport);
}
