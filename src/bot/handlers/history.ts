import type { Telegraf, Context } from 'telegraf';
import { countTransactions, deleteTransaction, listTransactions } from '../../transactions.js';
import { getOrCreateUser } from '../../users.js';
import { categoryEmoji } from '../../categories.js';
import { capitalize, escapeHtml, formatAmount } from '../../format.js';
import { formatLocalDateTime } from '../../time.js';
import { confirmDeleteKeyboard, historyKeyboard, backToMenuKeyboard } from '../keyboards.js';
import { log } from '../../logger.js';

const PAGE_SIZE = 10;

export async function sendHistory(ctx: Context, page = 0): Promise<void> {
  if (!ctx.from) return;
  const user = await getOrCreateUser(ctx.from.id);
  const total = await countTransactions(ctx.from.id);
  if (total === 0) {
    const opts = { parse_mode: 'HTML' as const, ...backToMenuKeyboard() };
    if (ctx.callbackQuery) {
      await safeEdit(ctx, '📭 История пуста.', opts);
    } else {
      await ctx.reply('📭 История пуста.', opts);
    }
    return;
  }
  const offset = page * PAGE_SIZE;
  const rows = await listTransactions(ctx.from.id, PAGE_SIZE, offset);
  if (rows.length === 0 && page > 0) {
    // Past the end — drop back to page 0.
    return sendHistory(ctx, 0);
  }
  const symbol = user.currency_symbol;
  const lines = rows.map((r) => {
    const sign = r.type === 'income' ? '+' : '−';
    const note = r.note ? ` <i>${escapeHtml(r.note)}</i>` : '';
    return (
      `${categoryEmoji(r.category)} <b>${escapeHtml(capitalize(r.category))}</b> ` +
      `<code>${sign}${escapeHtml(formatAmount(r.amount, symbol))}</code>${note}\n` +
      `<i>${escapeHtml(formatLocalDateTime(user.tz, new Date(r.created_at)))}</i> · id <code>${r.id}</code>`
    );
  });
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const text = `📜 <b>История (стр. ${page + 1} из ${totalPages})</b>\n\n${lines.join('\n\n')}`;
  const opts = {
    parse_mode: 'HTML' as const,
    ...historyKeyboard(
      page,
      offset + PAGE_SIZE < total,
      rows.map((r) => r.id),
    ),
  };
  if (ctx.callbackQuery) {
    await safeEdit(ctx, text, opts);
  } else {
    await ctx.reply(text, opts);
  }
}

async function safeEdit(ctx: Context, text: string, opts: Record<string, unknown>): Promise<void> {
  try {
    await ctx.editMessageText(text, opts);
  } catch (err) {
    log.debug('history edit failed; sending fresh', err);
    await ctx.reply(text, opts);
  }
}

export function registerHistory(bot: Telegraf): void {
  bot.command('history', (ctx) => sendHistory(ctx, 0));

  bot.action(/^delete:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const id = Number(ctx.match[1]);
    const pageMatch =
      (ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message : null) ??
      null;
    // We can't get the page reliably from the callback data; use 0 after delete.
    void pageMatch;
    try {
      await ctx.answerCbQuery();
      await ctx.reply(`Удалить транзакцию <code>#${id}</code>?`, {
        parse_mode: 'HTML',
        ...confirmDeleteKeyboard(id, 0),
      });
    } catch (err) {
      log.error('delete prompt failed', err);
    }
  });

  bot.action(/^delconfirm:(\d+):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const id = Number(ctx.match[1]);
    const page = Number(ctx.match[2]);
    try {
      const row = await deleteTransaction(ctx.from.id, id);
      if (!row) {
        await ctx.answerCbQuery('Уже удалено или не найдено.');
      } else {
        await ctx.answerCbQuery(`Удалено #${id}`);
      }
      try {
        await ctx.deleteMessage();
      } catch {
        // ignore
      }
      await sendHistory(ctx, page);
    } catch (err) {
      log.error('delete confirm failed', err);
      try {
        await ctx.answerCbQuery('Не удалось удалить.', { show_alert: true });
      } catch {
        // ignore
      }
    }
  });
}
