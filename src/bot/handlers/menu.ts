import type { Telegraf, Context } from 'telegraf';
import { exportPeriodKeyboard, mainMenuKeyboard } from '../keyboards.js';
import { sendToday } from './today.js';
import { sendWeek } from './week.js';
import { sendMonth } from './month.js';
import { sendAdvice } from './advice.js';
import { sendStats } from './stats.js';
import { sendBudget } from './budget.js';
import { sendHistory } from './history.js';
import { sendSettings } from './settings.js';
import { sendExport, sendExportPeriod } from './export.js';
import { sendHelp } from './start.js';
import { promptSearch } from './search.js';
import { sendSubs } from './subs.js';
import { sendGoal } from './goal.js';
import { log } from '../../logger.js';

const MENU_TEXT =
  `📋 <b>Главное меню</b>\n\n` +
  `Жми на кнопку или напиши трату текстом — я пойму через AI и сохраню.\n` +
  `Например: <code>такси 350, кофе 180</code> или <code>зп пришла 85000</code>.`;

export async function sendMenu(ctx: Context): Promise<void> {
  const opts = { parse_mode: 'HTML' as const, ...mainMenuKeyboard() };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(MENU_TEXT, opts);
      return;
    } catch (err) {
      log.debug('menu edit failed; sending fresh', err);
    }
  }
  await ctx.reply(MENU_TEXT, opts);
}

export function registerMenu(bot: Telegraf): void {
  bot.command('menu', sendMenu);

  bot.action('menu:home', async (ctx) => {
    await ctx.answerCbQuery();
    await sendMenu(ctx);
  });

  bot.action('menu:today', async (ctx) => {
    await ctx.answerCbQuery();
    await sendToday(ctx);
  });

  bot.action('menu:week', async (ctx) => {
    await ctx.answerCbQuery();
    await sendWeek(ctx);
  });

  bot.action('menu:month', async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonth(ctx);
  });

  bot.action('menu:advice', async (ctx) => {
    await ctx.answerCbQuery();
    await sendAdvice(ctx);
  });

  bot.action('menu:stats', async (ctx) => {
    await ctx.answerCbQuery();
    await sendStats(ctx);
  });

  bot.action('menu:budget', async (ctx) => {
    await ctx.answerCbQuery();
    await sendBudget(ctx);
  });

  bot.action('menu:subs', async (ctx) => {
    await ctx.answerCbQuery();
    await sendSubs(ctx);
  });

  bot.action('menu:goal', async (ctx) => {
    await ctx.answerCbQuery();
    await sendGoal(ctx);
  });

  bot.action('menu:search', async (ctx) => {
    await ctx.answerCbQuery();
    await promptSearch(ctx);
  });

  bot.action(/^menu:history:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = Number(ctx.match[1]);
    await sendHistory(ctx, page);
  });

  bot.action('menu:settings', async (ctx) => {
    await ctx.answerCbQuery();
    await sendSettings(ctx);
  });

  bot.action('menu:export', async (ctx) => {
    await ctx.answerCbQuery();
    const opts = {
      parse_mode: 'HTML' as const,
      ...exportPeriodKeyboard(),
    };
    const text = '📂 <b>Экспорт CSV</b>\n\nВыбери период:';
    try {
      await ctx.editMessageText(text, opts);
    } catch {
      await ctx.reply(text, opts);
    }
  });

  bot.action(/^export:(week|month|quarter|year|all)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const period = ctx.match[1] as 'week' | 'month' | 'quarter' | 'year' | 'all';
    if (period === 'month') {
      await sendExport(ctx);
    } else {
      await sendExportPeriod(ctx, period);
    }
  });

  bot.action('menu:help', async (ctx) => {
    await ctx.answerCbQuery();
    await sendHelp(ctx);
  });

  // Period navigation: nav:{today|week|month}:{offset}
  bot.action(/^nav:today:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendToday(ctx, Number(ctx.match[1]));
  });
  bot.action(/^nav:week:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendWeek(ctx, Number(ctx.match[1]));
  });
  bot.action(/^nav:month:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonth(ctx, Number(ctx.match[1]));
  });
}
