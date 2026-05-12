import type { Telegraf, Context } from 'telegraf';
import {
  deleteAllBudgets,
  deleteBudget,
  getMonthSpentByCategory,
  listBudgets,
  monthStart,
  nextMonthStart,
  setBudget,
} from '../../budgets.js';
import { getOrCreateUser } from '../../users.js';
import { CATEGORIES, categoryEmoji, normalizeCategory } from '../../categories.js';
import { capitalize, escapeHtml, formatAmount, rublesToKopecks } from '../../format.js';
import {
  backToMenuKeyboard,
  budgetAmountKeyboard,
  budgetMenuKeyboard,
  categoryListPickerKeyboard,
} from '../keyboards.js';
import { setPending } from '../../pendingInput.js';
import { log } from '../../logger.js';

const NON_INCOME = CATEGORIES.filter((c) => c !== 'зарплата');

export async function sendBudget(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const user = await getOrCreateUser(ctx.from.id);
  const ms = monthStart(user.tz);
  const nms = nextMonthStart(user.tz);
  const budgets = await listBudgets(ctx.from.id, ms);

  let body: string;
  if (budgets.length === 0) {
    body =
      `💼 <b>Бюджеты на месяц</b>\n\n` +
      `Лимитов пока нет. Нажми «➕ Установить», чтобы добавить бюджет на категорию.\n\n` +
      `Я предупрежу, когда расходы достигнут <b>80%</b> и <b>100%</b> от лимита.`;
  } else {
    const lines: string[] = [];
    for (const b of budgets) {
      const spent = await getMonthSpentByCategory(ctx.from.id, b.category, ms, nms);
      const pct = b.limit_amt > 0 ? (spent / b.limit_amt) * 100 : 0;
      const bar = renderBar(pct);
      const marker = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      lines.push(
        `${categoryEmoji(b.category)} <b>${escapeHtml(capitalize(b.category))}</b>\n` +
          `${marker} <code>${bar}</code> ${pct.toFixed(0)}%\n` +
          `${escapeHtml(formatAmount(spent, user.currency_symbol))} из ` +
          `${escapeHtml(formatAmount(b.limit_amt, user.currency_symbol))}`,
      );
    }
    body = `💼 <b>Бюджеты на месяц</b>\n\n${lines.join('\n\n')}`;
  }
  const opts = {
    parse_mode: 'HTML' as const,
    ...budgetMenuKeyboard(budgets.length > 0),
  };
  if (ctx.callbackQuery) {
    await safeEdit(ctx, body, opts);
  } else {
    await ctx.reply(body, opts);
  }
}

async function safeEdit(ctx: Context, text: string, opts: Record<string, unknown>): Promise<void> {
  try {
    await ctx.editMessageText(text, opts);
  } catch (err) {
    log.debug('budget edit failed; sending fresh', err);
    await ctx.reply(text, opts);
  }
}

export function registerBudget(bot: Telegraf): void {
  bot.command('budget', async (ctx: Context) => {
    if (!ctx.from) return;
    const user = await getOrCreateUser(ctx.from.id);
    const text = (ctx.message && 'text' in ctx.message ? ctx.message.text : '') ?? '';
    const args = text.split(/\s+/).slice(1);

    // Backwards-compatible quick syntax: /budget <category> <amount|off>
    if (args.length >= 2) {
      const category = normalizeCategory(args[0]);
      const amountRaw = args.slice(1).join(' ').trim();
      const ms = monthStart(user.tz);
      if (amountRaw.toLowerCase() === 'off' || amountRaw === '0') {
        const ok = await deleteBudget(ctx.from.id, category, ms);
        await ctx.reply(
          ok
            ? `✅ Бюджет на <b>${escapeHtml(capitalize(category))}</b> удалён.`
            : `ℹ️ Бюджета на <b>${escapeHtml(capitalize(category))}</b> не было.`,
          { parse_mode: 'HTML', ...backToMenuKeyboard() },
        );
        return;
      }
      const amount = Number(amountRaw.replace(',', '.'));
      if (Number.isFinite(amount) && amount > 0) {
        const kopecks = rublesToKopecks(amount);
        await setBudget(ctx.from.id, category, kopecks, ms);
        await ctx.reply(
          `✅ Установлен бюджет на <b>${escapeHtml(capitalize(category))}</b>: ` +
            `${escapeHtml(formatAmount(kopecks, user.currency_symbol))} в месяц.\n` +
            `Я предупрежу при достижении 80% и 100%.`,
          { parse_mode: 'HTML', ...backToMenuKeyboard() },
        );
        return;
      }
    }
    await sendBudget(ctx);
  });

  bot.action('budget:add', async (ctx) => {
    await ctx.answerCbQuery();
    const text = '➕ <b>Выбери категорию для бюджета</b>';
    const opts = {
      parse_mode: 'HTML' as const,
      ...categoryListPickerKeyboard('budget:cat', NON_INCOME),
    };
    try {
      await ctx.editMessageText(text, opts);
    } catch {
      await ctx.reply(text, opts);
    }
  });

  bot.action(/^budget:cat:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const cat = ctx.match[1];
    const text =
      `💰 <b>Сколько в месяц на «${escapeHtml(capitalize(cat))}»?</b>\n\n` +
      `Выбери один из вариантов или напиши боту в чат: <code>/budget ${escapeHtml(cat)} 12000</code>.`;
    const opts = {
      parse_mode: 'HTML' as const,
      ...budgetAmountKeyboard(cat),
    };
    try {
      await ctx.editMessageText(text, opts);
    } catch {
      await ctx.reply(text, opts);
    }
  });

  bot.action(/^budget:custom:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    const cat = ctx.match[1];
    await setPending(ctx.from.id, { kind: 'budget', category: cat });
    await ctx.reply(
      `✏️ <b>Сумма бюджета на «${escapeHtml(capitalize(cat))}»</b>\n\n` +
        `Отправь число в рублях — например <code>12000</code>.`,
      { parse_mode: 'HTML' },
    );
  });

  bot.action(/^budget:set:([^:]+):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const cat = ctx.match[1];
    const amount = Number(ctx.match[2]);
    const user = await getOrCreateUser(ctx.from.id);
    const ms = monthStart(user.tz);
    const kopecks = rublesToKopecks(amount);
    await setBudget(ctx.from.id, cat, kopecks, ms);
    await ctx.answerCbQuery(`✅ ${cat}: ${amount}`);
    await sendBudget(ctx);
  });

  bot.action('budget:del', async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    const user = await getOrCreateUser(ctx.from.id);
    const ms = monthStart(user.tz);
    const list = await listBudgets(ctx.from.id, ms);
    const cats = list.map((b) => b.category);
    if (cats.length === 0) {
      await sendBudget(ctx);
      return;
    }
    const text = '🗑 <b>Какой бюджет удалить?</b>';
    const opts = {
      parse_mode: 'HTML' as const,
      ...categoryListPickerKeyboard('budget:delcat', cats),
    };
    try {
      await ctx.editMessageText(text, opts);
    } catch {
      await ctx.reply(text, opts);
    }
  });

  bot.action(/^budget:delcat:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const cat = ctx.match[1];
    if (cat === 'cancel') {
      await ctx.answerCbQuery();
      await sendBudget(ctx);
      return;
    }
    const user = await getOrCreateUser(ctx.from.id);
    const ms = monthStart(user.tz);
    await deleteBudget(ctx.from.id, cat, ms);
    await ctx.answerCbQuery(`🗑 ${cat}`);
    await sendBudget(ctx);
  });

  bot.action(/^budget:cat:cancel$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendBudget(ctx);
  });

  bot.action('budget:reset', async (ctx) => {
    if (!ctx.from) return;
    const user = await getOrCreateUser(ctx.from.id);
    const ms = monthStart(user.tz);
    const n = await deleteAllBudgets(ctx.from.id, ms);
    await ctx.answerCbQuery(`Сброшено: ${n}`);
    await sendBudget(ctx);
  });
}

function renderBar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
