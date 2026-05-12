import type { Telegraf, Context } from 'telegraf';
import { getOrCreateUser, setUserCurrency, setUserNotify, setUserTz } from '../../users.js';
import { escapeHtml } from '../../format.js';
import { currencyKeyboard, settingsKeyboard, tzKeyboard } from '../keyboards.js';
import { log } from '../../logger.js';

export async function sendSettings(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const user = await getOrCreateUser(ctx.from.id);
  const text =
    `⚙️ <b>Настройки</b>\n\n` +
    `🌍 Таймзона: <code>${escapeHtml(user.tz)}</code>\n` +
    `💱 Валюта: <code>${escapeHtml(user.currency)}</code> (${escapeHtml(user.currency_symbol)})\n` +
    `🔔 Уведомления: ${user.notify ? '<b>включены</b>' : '<b>выключены</b>'}`;
  const opts = { parse_mode: 'HTML' as const, ...settingsKeyboard(user.notify) };
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
    log.debug('settings edit failed; sending fresh', err);
    await ctx.reply(text, opts);
  }
}

async function showTzPicker(ctx: Context): Promise<void> {
  const text = '🌍 <b>Выбери таймзону</b>';
  const opts = { parse_mode: 'HTML' as const, ...tzKeyboard() };
  try {
    await ctx.editMessageText(text, opts);
  } catch {
    await ctx.reply(text, opts);
  }
}

async function showCurrencyPicker(ctx: Context): Promise<void> {
  const text = '💱 <b>Выбери валюту</b>';
  const opts = { parse_mode: 'HTML' as const, ...currencyKeyboard() };
  try {
    await ctx.editMessageText(text, opts);
  } catch {
    await ctx.reply(text, opts);
  }
}

export function registerSettings(bot: Telegraf): void {
  bot.command('settings', sendSettings);

  bot.action('settings:tz', async (ctx) => {
    await ctx.answerCbQuery();
    await showTzPicker(ctx);
  });

  bot.action('settings:cur', async (ctx) => {
    await ctx.answerCbQuery();
    await showCurrencyPicker(ctx);
  });

  bot.action('settings:notify', async (ctx) => {
    if (!ctx.from) return;
    const user = await getOrCreateUser(ctx.from.id);
    await setUserNotify(ctx.from.id, !user.notify);
    await ctx.answerCbQuery(!user.notify ? '🔔 Включены' : '🔕 Выключены');
    await sendSettings(ctx);
  });

  bot.action(/^set:tz:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const tz = ctx.match[1];
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      await ctx.answerCbQuery('Неверная таймзона', { show_alert: true });
      return;
    }
    await setUserTz(ctx.from.id, tz);
    await ctx.answerCbQuery(`✅ ${tz}`);
    await sendSettings(ctx);
  });

  bot.action(/^set:cur:([A-Z]{3}):(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const code = ctx.match[1];
    const symbol = ctx.match[2];
    await setUserCurrency(ctx.from.id, code, symbol);
    await ctx.answerCbQuery(`✅ ${code} (${symbol})`);
    await sendSettings(ctx);
  });
}
