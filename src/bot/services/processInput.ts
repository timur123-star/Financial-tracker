/**
 * Shared "parse free text → save transactions → reply" pipeline.
 *
 * Used by both the text handler (typed messages) and the voice handler
 * (transcribed audio). Keeping the body here means voice messages get the
 * exact same NLP, budgeting, undo-token and reply UX as typed messages.
 */

import type { Context } from 'telegraf';
import { parseTransactions, chatAssistant } from '../../parser.js';
import { insertTransaction, getDayTotals } from '../../transactions.js';
import { getOrCreateUser } from '../../users.js';
import { categoryEmoji, normalizeCategory } from '../../categories.js';
import { capitalize, escapeHtml, formatAmount, rublesToKopecks } from '../../format.js';
import { log } from '../../logger.js';
import { metrics } from '../../metrics.js';
import { checkBudgetWarning } from '../../budgetCheck.js';
import { storeUndo } from '../../undo.js';
import { transactionActionsKeyboard } from '../keyboards.js';

export interface ProcessOpts {
  /** Free-form text to parse (typed by the user or transcribed from voice). */
  text: string;
  /** Source descriptor used to enrich the reply (e.g. "🎙 голос"). */
  sourcePrefix?: string;
  /**
   * Whether to fall back to a chit-chat reply for non-financial messages.
   * Voice handler: yes (user just spoke into the bot). CSV import: no.
   */
  smalltalkOnNotFinancial?: boolean;
}

export async function processFinancialText(ctx: Context, opts: ProcessOpts): Promise<void> {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  const text = opts.text;

  const user = await getOrCreateUser(userId);

  let typingHandle: ReturnType<typeof setInterval> | null = null;
  try {
    await ctx.sendChatAction('typing').catch(() => {});
    typingHandle = setInterval(() => {
      ctx.sendChatAction('typing').catch(() => {});
    }, 4000);

    const result = await parseTransactions(text);

    if (!result.ok) {
      if (result.reason === 'no_groq') {
        await ctx.reply(
          '🤖 NLP-парсер не настроен: задай переменную окружения <code>GROQ_API_KEY</code> ' +
            '(бесплатный ключ на console.groq.com/keys). Пока что используй /menu и команды.',
          { parse_mode: 'HTML' },
        );
        return;
      }
      if (result.reason === 'not_financial') {
        if (opts.smalltalkOnNotFinancial !== false) {
          const reply = await chatAssistant(text);
          await ctx.reply(reply);
        } else {
          await ctx.reply(
            '🤷 В сообщении нет финансовой операции. Я понимаю фразы вида «такси 350» или «зп 90000».',
          );
        }
        return;
      }
      await ctx.reply('⚠️ Не удалось распознать траты. Попробуй так: <code>такси 350</code>', {
        parse_mode: 'HTML',
      });
      return;
    }

    const savedIds: number[] = [];
    const summaries: string[] = [];

    for (const t of result.transactions) {
      const cat = normalizeCategory(t.category);
      const kopecks = rublesToKopecks(t.amount);
      const row = await insertTransaction({
        userId,
        amount: kopecks,
        type: t.type,
        category: cat,
        note: t.note ?? null,
        rawText: text,
      });
      savedIds.push(row.id);
      metrics.transactions.inc({ type: t.type });
      const emoji = categoryEmoji(cat);
      const sign = t.type === 'income' ? '+' : '−';
      const tail = t.note ? ` <i>(${escapeHtml(t.note)})</i>` : '';
      summaries.push(
        `${emoji} <b>${escapeHtml(capitalize(cat))}</b> ` +
          `<code>${sign}${escapeHtml(formatAmount(kopecks, user.currency_symbol))}</code>${tail}`,
      );
    }

    const day = await getDayTotals(userId, user.tz);
    const dayLine =
      `\n📅 За сегодня: <b>${escapeHtml(formatAmount(day.expense, user.currency_symbol))}</b>` +
      (day.income > 0
        ? ` · доход <b>${escapeHtml(formatAmount(day.income, user.currency_symbol))}</b>`
        : '');

    const sourceTag = opts.sourcePrefix ? `${opts.sourcePrefix} ` : '';
    const header =
      savedIds.length > 1
        ? `✅ ${sourceTag}Сохранил <b>${savedIds.length}</b> ${plural(savedIds.length, [
            'запись',
            'записи',
            'записей',
          ])}\n`
        : `✅ ${sourceTag}Сохранил\n`;
    const body = summaries.join('\n');

    const undoToken = await storeUndo(userId, savedIds);
    const kb = transactionActionsKeyboard(undoToken, savedIds);

    await ctx.reply(`${header}${body}\n${dayLine}`, {
      parse_mode: 'HTML',
      ...kb,
    });

    try {
      await checkBudgetWarning(ctx, userId, user, result.transactions);
    } catch (err) {
      log.warn('budget check failed', err);
    }
  } catch (err) {
    metrics.errors.inc({ component: 'processInput' });
    log.error('processFinancialText failed', err);
    await ctx.reply('⚠️ Что-то пошло не так. Попробуй ещё раз.');
  } finally {
    if (typingHandle) clearInterval(typingHandle);
  }
}

export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}
