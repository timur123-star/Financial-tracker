import type { Telegraf, Context } from 'telegraf';
import { getOrCreateUser } from '../../users.js';
import { capitalize, escapeHtml, formatAmount, rublesToKopecks } from '../../format.js';
import { peekPending, consumePending, setPending } from '../../pendingInput.js';
import { setBudget, monthStart } from '../../budgets.js';
import { setGoal } from '../../goals.js';
import { promptSubCategoryPicker } from './subs.js';
import { runSearch } from './search.js';
import { processFinancialText } from '../services/processInput.js';

const AMOUNT_RE = /^\s*([0-9][0-9\s.,]*)\s*$/;

function parseAmount(raw: string): number | null {
  const m = raw.match(AMOUNT_RE);
  if (!m) return null;
  const cleaned = m[1].replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function registerTextHandler(bot: Telegraf): void {
  bot.on('text', async (ctx: Context) => {
    const msg = ctx.message;
    if (!msg || !('text' in msg)) return;
    const text = msg.text;
    if (!text || text.startsWith('/')) return;
    if (!ctx.from) return;

    // 1. Capture pending-input intents from inline-button flows.
    const pending = await peekPending(ctx.from.id);
    if (pending) {
      const consumed = await consumePending(ctx.from.id);
      if (!consumed) return;

      if (consumed.kind === 'search') {
        await runSearch(ctx, text);
        return;
      }

      if (consumed.kind === 'budget') {
        const amount = parseAmount(text);
        const user = await getOrCreateUser(ctx.from.id);
        if (!amount) {
          await ctx.reply('⚠️ Не понял сумму. Введи число, например <code>12000</code>.', {
            parse_mode: 'HTML',
          });
          // re-arm so the next message tries again
          await setPending(ctx.from.id, consumed);
          return;
        }
        await setBudget(
          ctx.from.id,
          consumed.category,
          rublesToKopecks(amount),
          monthStart(user.tz),
        );
        await ctx.reply(
          `✅ Бюджет на <b>${escapeHtml(capitalize(consumed.category))}</b>: ` +
            `${escapeHtml(formatAmount(rublesToKopecks(amount), user.currency_symbol))} в месяц.`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (consumed.kind === 'goal') {
        const amount = parseAmount(text);
        const user = await getOrCreateUser(ctx.from.id);
        if (!amount) {
          await ctx.reply('⚠️ Не понял сумму. Введи число, например <code>45000</code>.', {
            parse_mode: 'HTML',
          });
          await setPending(ctx.from.id, consumed);
          return;
        }
        await setGoal(ctx.from.id, user.tz, rublesToKopecks(amount));
        await ctx.reply(
          `🎯 Цель установлена: <b>${escapeHtml(
            formatAmount(rublesToKopecks(amount), user.currency_symbol),
          )}</b> на месяц.`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (consumed.kind === 'subscription') {
        if (consumed.step === 'amount') {
          const amount = parseAmount(text);
          if (!amount) {
            await ctx.reply('⚠️ Не понял сумму. Введи число, например <code>349</code>.', {
              parse_mode: 'HTML',
            });
            await setPending(ctx.from.id, consumed);
            return;
          }
          consumed.draft.amount = rublesToKopecks(amount);
          consumed.step = 'note';
          await setPending(ctx.from.id, consumed);
          await promptSubCategoryPicker(ctx);
          return;
        }
      }
    }

    await processFinancialText(ctx, { text });
  });
}
