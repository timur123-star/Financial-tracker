import type { Telegraf, Context } from 'telegraf';
import { getOrCreateUser } from '../../users.js';
import { deleteGoal, getCurrentGoal, setGoal } from '../../goals.js';
import { getRangeTotals } from '../../transactions.js';
import { monthStart, nextMonthStart } from '../../budgets.js';
import { capitalize, escapeHtml, formatAmount, rublesToKopecks } from '../../format.js';
import { formatMonthName } from '../../time.js';
import { backToMenuKeyboard, goalAmountKeyboard, goalMenuKeyboard } from '../keyboards.js';
import { setPending } from '../../pendingInput.js';
import { log } from '../../logger.js';

export async function sendGoal(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const user = await getOrCreateUser(ctx.from.id);
  const goal = await getCurrentGoal(ctx.from.id, user.tz);
  const ms = monthStart(user.tz);
  const totals = await getRangeTotals({
    userId: ctx.from.id,
    tz: user.tz,
    from: ms,
    to: nextMonthStart(user.tz),
  });
  const monthLabel = capitalize(formatMonthName(user.tz, ms));

  let body: string;
  if (!goal) {
    body =
      `🎯 <b>Цель на ${escapeHtml(monthLabel)}</b>\n\n` +
      `Цели нет. Установи лимит общих расходов на месяц — бот будет показывать прогресс ` +
      `в /stats, /month и предупредит при <b>80%</b> и <b>100%</b>.`;
  } else {
    const pct = goal.target_amt > 0 ? (totals.expense / goal.target_amt) * 100 : 0;
    const marker = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
    const bar = renderBar(pct);
    body =
      `🎯 <b>Цель на ${escapeHtml(monthLabel)}</b>\n\n` +
      `Лимит: <b>${escapeHtml(formatAmount(goal.target_amt, user.currency_symbol))}</b>\n` +
      `Потрачено: <b>${escapeHtml(formatAmount(totals.expense, user.currency_symbol))}</b>\n` +
      `${marker} <code>${bar}</code> <b>${pct.toFixed(0)}%</b>`;
  }
  const opts = { parse_mode: 'HTML' as const, ...goalMenuKeyboard(Boolean(goal)) };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(body, opts);
      return;
    } catch (err) {
      log.debug('goal edit failed', err);
    }
  }
  await ctx.reply(body, opts);
}

export function registerGoal(bot: Telegraf): void {
  bot.command('goal', async (ctx) => {
    const raw = (ctx.message && 'text' in ctx.message ? ctx.message.text : '') ?? '';
    const args = raw.split(/\s+/).slice(1).join(' ').trim();
    if (args.toLowerCase() === 'off' || args === '0') {
      if (!ctx.from) return;
      const user = await getOrCreateUser(ctx.from.id);
      await deleteGoal(ctx.from.id, user.tz);
      await ctx.reply('🗑 Цель снята.', backToMenuKeyboard());
      return;
    }
    if (args.length > 0) {
      if (!ctx.from) return;
      const user = await getOrCreateUser(ctx.from.id);
      const amount = Number(args.replace(',', '.'));
      if (Number.isFinite(amount) && amount > 0) {
        await setGoal(ctx.from.id, user.tz, rublesToKopecks(amount));
        await sendGoal(ctx);
        return;
      }
    }
    await sendGoal(ctx);
  });

  bot.action('menu:goal', async (ctx) => {
    await ctx.answerCbQuery();
    await sendGoal(ctx);
  });

  bot.action('goal:set', async (ctx) => {
    await ctx.answerCbQuery();
    const text = '🎯 <b>Цель на месяц</b>\n\nВыбери лимит расходов или нажми «Своя сумма».';
    const opts = { parse_mode: 'HTML' as const, ...goalAmountKeyboard() };
    try {
      await ctx.editMessageText(text, opts);
    } catch {
      await ctx.reply(text, opts);
    }
  });

  bot.action(/^goal:set:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const amount = Number(ctx.match[1]);
    const user = await getOrCreateUser(ctx.from.id);
    await setGoal(ctx.from.id, user.tz, rublesToKopecks(amount));
    await ctx.answerCbQuery(`✅ ${amount.toLocaleString('ru-RU')}`);
    await sendGoal(ctx);
  });

  bot.action('goal:custom', async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    await setPending(ctx.from.id, { kind: 'goal' });
    await ctx.reply(
      '✏️ <b>Введи сумму цели в рублях</b>\n\nНапример: <code>45000</code> или <code>62 500</code>.',
      { parse_mode: 'HTML' },
    );
  });

  bot.action('goal:del', async (ctx) => {
    if (!ctx.from) return;
    const user = await getOrCreateUser(ctx.from.id);
    await deleteGoal(ctx.from.id, user.tz);
    await ctx.answerCbQuery('🗑 Снято');
    await sendGoal(ctx);
  });
}

function renderBar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
