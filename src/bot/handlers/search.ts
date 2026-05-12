import type { Telegraf, Context } from 'telegraf';
import { searchTransactions } from '../../transactions.js';
import { getOrCreateUser } from '../../users.js';
import { categoryEmoji } from '../../categories.js';
import { capitalize, escapeHtml, formatAmount } from '../../format.js';
import { formatLocalDateTime } from '../../time.js';
import { backToMenuKeyboard } from '../keyboards.js';
import { setPending } from '../../pendingInput.js';
import { log } from '../../logger.js';

const MAX_RESULTS = 20;

export async function promptSearch(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await setPending(ctx.from.id, { kind: 'search' });
  const text =
    '🔎 <b>Поиск по истории</b>\n\n' +
    'Отправь следующим сообщением слово для поиска — найду в категориях и заметках. ' +
    'Например: <code>такси</code> или <code>aliexpress</code>.';
  const opts = { parse_mode: 'HTML' as const, ...backToMenuKeyboard() };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch (err) {
      log.debug('search prompt edit failed', err);
    }
  }
  await ctx.reply(text, opts);
}

export async function runSearch(ctx: Context, query: string): Promise<void> {
  if (!ctx.from) return;
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    await ctx.reply('Слишком короткий запрос — минимум 2 символа.');
    return;
  }
  const user = await getOrCreateUser(ctx.from.id);
  const rows = await searchTransactions(ctx.from.id, trimmed, MAX_RESULTS);
  if (rows.length === 0) {
    await ctx.reply(`🤷 По запросу «<b>${escapeHtml(trimmed)}</b>» ничего не нашёл.`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard(),
    });
    return;
  }
  const lines = rows.map((r) => {
    const sign = r.type === 'income' ? '+' : '−';
    const note = r.note ? ` <i>${escapeHtml(r.note)}</i>` : '';
    return (
      `${categoryEmoji(r.category)} <b>${escapeHtml(capitalize(r.category))}</b> ` +
      `<code>${sign}${escapeHtml(formatAmount(r.amount, user.currency_symbol))}</code>${note}\n` +
      `<i>${escapeHtml(formatLocalDateTime(user.tz, new Date(r.created_at)))}</i>`
    );
  });
  await ctx.reply(
    `🔎 <b>Найдено: ${rows.length}</b> по «<b>${escapeHtml(trimmed)}</b>»\n\n${lines.join('\n\n')}`,
    { parse_mode: 'HTML', ...backToMenuKeyboard() },
  );
}

export function registerSearch(bot: Telegraf): void {
  bot.command('search', async (ctx) => {
    const raw = (ctx.message && 'text' in ctx.message ? ctx.message.text : '') ?? '';
    const args = raw.split(/\s+/).slice(1).join(' ').trim();
    if (args.length === 0) {
      await promptSearch(ctx);
      return;
    }
    await runSearch(ctx, args);
  });
}
