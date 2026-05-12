import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { log } from '../logger.js';
import { metrics } from '../metrics.js';
import { registerStart } from './handlers/start.js';
import { registerToday } from './handlers/today.js';
import { registerWeek } from './handlers/week.js';
import { registerMonth } from './handlers/month.js';
import { registerAdvice } from './handlers/advice.js';
import { registerStats } from './handlers/stats.js';
import { registerHistory } from './handlers/history.js';
import { registerExport } from './handlers/export.js';
import { registerBudget } from './handlers/budget.js';
import { registerSettings } from './handlers/settings.js';
import { registerMenu } from './handlers/menu.js';
import { registerEditCategory } from './handlers/editCategory.js';
import { registerUndoHandler } from './handlers/undo.js';
import { registerSubs } from './handlers/subs.js';
import { registerSearch } from './handlers/search.js';
import { registerGoal } from './handlers/goal.js';
import { registerVoice } from './handlers/voice.js';
import { registerImport } from './handlers/import.js';
import { registerTextHandler } from './handlers/text.js';
import { rateLimit } from './middleware/rateLimit.js';

export function buildBot(): Telegraf {
  const bot = new Telegraf(config.telegramToken, { handlerTimeout: 90_000 });

  // Per-user rate limit via Redis — drops excess silently and tells the user
  // once per window. Configurable via RATE_LIMIT_* env vars.
  bot.use(
    rateLimit({
      windowSeconds: config.rateLimitWindowSec,
      max: config.rateLimitMax,
    }),
  );

  // Request logging + metrics. Every update is counted by `updateType` and
  // duration is sampled into the histogram so dashboards can chart p95 latency.
  bot.use(async (ctx, next) => {
    const started = Date.now();
    const updateType = ctx.updateType ?? 'unknown';
    metrics.updates.inc({ type: updateType });
    const stop = metrics.handlerDuration.startTimer({ kind: updateType });
    const kind =
      updateType +
      (ctx.message && 'text' in ctx.message
        ? ` "${(ctx.message.text ?? '').slice(0, 40)}"`
        : ctx.callbackQuery && 'data' in ctx.callbackQuery
          ? ` cb:${ctx.callbackQuery.data}`
          : '');
    try {
      await next();
    } finally {
      stop();
      log.debug(`update ${kind} user=${ctx.from?.id ?? '?'} dt=${Date.now() - started}ms`);
    }
  });

  bot.catch((err, ctx) => {
    metrics.errors.inc({ component: 'bot' });
    log.error('bot error', err, 'update:', ctx.update);
  });

  registerStart(bot);
  registerMenu(bot);
  registerToday(bot);
  registerWeek(bot);
  registerMonth(bot);
  registerAdvice(bot);
  registerStats(bot);
  registerHistory(bot);
  registerExport(bot);
  registerImport(bot);
  registerBudget(bot);
  registerSubs(bot);
  registerGoal(bot);
  registerSearch(bot);
  registerSettings(bot);
  registerVoice(bot);

  registerUndoHandler(bot);
  registerEditCategory(bot);

  // Free-text NLP must be last so commands match first.
  registerTextHandler(bot);

  return bot;
}

export async function setBotCommands(bot: Telegraf): Promise<void> {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Начать / справка' },
    { command: 'menu', description: 'Главное меню' },
    { command: 'today', description: 'Итог за сегодня' },
    { command: 'week', description: 'График за неделю' },
    { command: 'month', description: 'График за месяц' },
    { command: 'stats', description: 'Статистика и сравнение' },
    { command: 'advice', description: 'AI-анализ трат' },
    { command: 'budget', description: 'Бюджеты по категориям' },
    { command: 'goal', description: 'Цель на месяц' },
    { command: 'subs', description: 'Подписки и регулярные платежи' },
    { command: 'search', description: 'Поиск по истории' },
    { command: 'history', description: 'История операций' },
    { command: 'export', description: 'Экспорт CSV' },
    { command: 'import', description: 'Импорт CSV' },
    { command: 'settings', description: 'Таймзона, валюта, уведомления' },
    { command: 'help', description: 'Справка' },
  ]);
}
