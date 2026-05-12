import type { Context } from 'telegraf';
import { getBudget, getMonthSpentByCategory, monthStart, nextMonthStart } from './budgets.js';
import { categoryEmoji } from './categories.js';
import { escapeHtml, formatAmount } from './format.js';
import { capitalize } from './format.js';
import type { ParsedTransaction } from './parser.js';
import type { UserRow } from './users.js';
import { getRedis } from './redis.js';

const NOTIFY_THRESHOLDS = [0.8, 1.0]; // 80% and 100%

function notifyKey(userId: number, category: string, month: string, threshold: number): string {
  return `budget_notify:${userId}:${category}:${month}:${threshold}`;
}

export async function checkBudgetWarning(
  ctx: Context,
  userId: number,
  user: UserRow,
  txs: ParsedTransaction[],
): Promise<void> {
  // Only check the categories that just got expenses
  const expenseCategories = Array.from(
    new Set(txs.filter((t) => t.type === 'expense').map((t) => t.category)),
  );
  if (expenseCategories.length === 0) return;

  const ms = monthStart(user.tz);
  const next = nextMonthStart(user.tz);
  const monthKey = ms.toISOString().slice(0, 10);
  const redis = await getRedis();

  for (const category of expenseCategories) {
    const budget = await getBudget(userId, category, ms);
    if (!budget) continue;
    const spent = await getMonthSpentByCategory(userId, category, ms, next);
    const pct = spent / budget.limit_amt;
    let crossed: number | null = null;
    for (const t of NOTIFY_THRESHOLDS) {
      if (pct >= t) crossed = t;
    }
    if (crossed === null) continue;

    const already = await redis.get(notifyKey(userId, category, monthKey, crossed));
    if (already) continue;
    await redis.set(notifyKey(userId, category, monthKey, crossed), '1', { EX: 35 * 24 * 3600 });

    const emoji = categoryEmoji(category);
    const symbol = user.currency_symbol;
    const limitStr = formatAmount(budget.limit_amt, symbol);
    const spentStr = formatAmount(spent, symbol);
    const pctStr = (pct * 100).toFixed(0);
    const headline =
      crossed >= 1.0
        ? `🚨 Бюджет на ${escapeHtml(category)} превышен!`
        : `⚠️ Бюджет на ${escapeHtml(category)} почти исчерпан`;
    await ctx.reply(
      `${headline}\n${emoji} <b>${escapeHtml(capitalize(category))}</b>: ` +
        `${escapeHtml(spentStr)} / ${escapeHtml(limitStr)} (${pctStr}%)`,
      { parse_mode: 'HTML' },
    );
  }
}
