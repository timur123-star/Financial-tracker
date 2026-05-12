import type { Telegraf, Context } from 'telegraf';
import {
  CADENCE_LABEL,
  advance,
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  setSubscriptionActive,
  type SubCadence,
  type SubRow,
} from '../../subscriptions.js';
import { CATEGORIES, categoryEmoji, normalizeCategory } from '../../categories.js';
import { getOrCreateUser } from '../../users.js';
import { capitalize, escapeHtml, formatAmount } from '../../format.js';
import { formatLocalDate } from '../../time.js';
import {
  cadencePickerKeyboard,
  categoryListPickerKeyboard,
  subsMenuKeyboard,
} from '../keyboards.js';
import { setPending, peekPending, consumePending, clearPending } from '../../pendingInput.js';
import { log } from '../../logger.js';

const NON_INCOME = CATEGORIES.filter((c) => c !== 'зарплата');

export async function sendSubs(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const user = await getOrCreateUser(ctx.from.id);
  const list = await listSubscriptions(ctx.from.id);
  const body =
    list.length === 0
      ? '🔁 <b>Подписки</b>\n\nЗдесь живут повторяющиеся транзакции — зарплата, рента, Netflix, ' +
        'iCloud. Бот будет автоматически записывать их в нужный день.'
      : '🔁 <b>Подписки</b>\n\n' +
        list.map((s) => formatSub(s, user.tz, user.currency_symbol)).join('\n\n');
  const menuItems = list.map((s) => ({
    id: s.id,
    label: `${categoryEmoji(s.category)} ${capitalize(s.category)} · ${formatAmount(s.amount, user.currency_symbol)} · ${CADENCE_LABEL[s.cadence]}`,
    active: s.active,
  }));
  const opts = { parse_mode: 'HTML' as const, ...subsMenuKeyboard(menuItems) };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(body, opts);
      return;
    } catch (err) {
      log.debug('subs edit failed', err);
    }
  }
  await ctx.reply(body, opts);
}

function formatSub(s: SubRow, tz: string, symbol: string): string {
  const sign = s.type === 'income' ? '+' : '−';
  const note = s.note ? ` <i>${escapeHtml(s.note)}</i>` : '';
  return (
    `${s.active ? '✅' : '⏸'} ${categoryEmoji(s.category)} <b>${escapeHtml(capitalize(s.category))}</b> ` +
    `<code>${sign}${escapeHtml(formatAmount(s.amount, symbol))}</code>${note}\n` +
    `<i>${escapeHtml(CADENCE_LABEL[s.cadence])} · следующая: ${escapeHtml(formatLocalDate(tz, s.next_charge))}</i>`
  );
}

export function registerSubs(bot: Telegraf): void {
  bot.command('subs', sendSubs);

  bot.action('menu:subs', async (ctx) => {
    await ctx.answerCbQuery();
    await sendSubs(ctx);
  });

  bot.action('subs:add', async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    await setPending(ctx.from.id, {
      kind: 'subscription',
      step: 'amount',
      draft: { type: 'expense', note: null },
    });
    await ctx.reply(
      '➕ <b>Новая подписка</b>\n\n' +
        'Шаг 1 из 3. Сколько списывать? Отправь число в рублях.\n' +
        'Например: <code>349</code> или <code>10 500</code>.',
      { parse_mode: 'HTML' },
    );
  });

  bot.action(/^subs:toggle:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const id = Number(ctx.match[1]);
    const subs = await listSubscriptions(ctx.from.id);
    const cur = subs.find((s) => s.id === id);
    if (!cur) {
      await ctx.answerCbQuery('Не найдено');
      return;
    }
    await setSubscriptionActive(ctx.from.id, id, !cur.active);
    await ctx.answerCbQuery(cur.active ? '⏸ На паузе' : '✅ Активна');
    await sendSubs(ctx);
  });

  bot.action(/^subs:del:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const id = Number(ctx.match[1]);
    await deleteSubscription(ctx.from.id, id);
    await ctx.answerCbQuery('🗑 Удалена');
    await sendSubs(ctx);
  });

  bot.action(/^subs:cat:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    const cat = ctx.match[1];
    if (cat === 'cancel') {
      await clearPending(ctx.from.id);
      await sendSubs(ctx);
      return;
    }
    const intent = await peekPending(ctx.from.id);
    if (!intent || intent.kind !== 'subscription') {
      await sendSubs(ctx);
      return;
    }
    intent.draft.category = normalizeCategory(cat);
    intent.step = 'cadence';
    await setPending(ctx.from.id, intent);
    const text = `🔁 <b>Подписка</b>\n\nШаг 3 из 3. Как часто?`;
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...cadencePickerKeyboard(),
      });
    } catch {
      await ctx.reply(text, { parse_mode: 'HTML', ...cadencePickerKeyboard() });
    }
  });

  bot.action(/^subs:cad:(daily|weekly|monthly|yearly)$/, async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    const cadence = ctx.match[1] as SubCadence;
    const intent = await consumePending(ctx.from.id);
    if (!intent || intent.kind !== 'subscription') {
      await sendSubs(ctx);
      return;
    }
    const d = intent.draft;
    if (!d.amount || !d.category) {
      await ctx.reply('Что-то пошло не так — начнём заново.');
      await sendSubs(ctx);
      return;
    }
    const user = await getOrCreateUser(ctx.from.id);
    const nextCharge = advance(new Date(), cadence);
    nextCharge.setTime(nextCharge.getTime()); // already advanced
    await createSubscription({
      userId: ctx.from.id,
      amount: d.amount,
      category: d.category,
      note: d.note ?? null,
      type: d.type ?? 'expense',
      cadence,
      nextCharge,
    });
    void user;
    await sendSubs(ctx);
  });

  bot.action('subs:cancel', async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCbQuery();
    await clearPending(ctx.from.id);
    await sendSubs(ctx);
  });
}

/** Picker shown after the user types the amount. */
export async function promptSubCategoryPicker(ctx: Context): Promise<void> {
  await ctx.reply('🔁 <b>Подписка</b>\n\nШаг 2 из 3. Выбери категорию:', {
    parse_mode: 'HTML',
    ...categoryListPickerKeyboard('subs:cat', NON_INCOME, 'menu:subs'),
  });
}
