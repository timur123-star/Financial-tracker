import type { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { upsertUser } from '../../users.js';
import { mainMenuKeyboard } from '../keyboards.js';
import { insertTransaction } from '../../transactions.js';
import { getOrCreateUser } from '../../users.js';
import { rublesToKopecks } from '../../format.js';

const WELCOME =
  `👋 <b>Привет! Я твой персональный финансовый трекер.</b>\n\n` +
  `Просто пиши, что потратил — обычным текстом, я пойму через AI и сохраню в правильную ` +
  `категорию.\n\n` +
  `<b>📝 Примеры:</b>\n` +
  `• <code>потратил 800 на продукты</code>\n` +
  `• <code>такси 350</code>\n` +
  `• <code>кофе 180, обед 650, такси 200</code>\n` +
  `• <code>зп пришла 85000</code>\n\n` +
  `<b>⚡ Что я умею:</b>\n` +
  `📅 День / неделя / месяц / квартал / год — навигация по периодам\n` +
  `📊 PNG-графики с процентами по категориям + дневная динамика\n` +
  `🧠 AI-советник: где перетратил, где сэкономил, что оптимизировать\n` +
  `💼 Бюджеты по категориям с предупреждением на 80% и 100%\n` +
  `🎯 Цель на месяц — общий лимит расходов\n` +
  `🔁 Подписки — авто-запись повторяющихся трат и доходов\n` +
  `🔎 Поиск по истории (по тексту и категориям)\n` +
  `🔥 Серии дней подряд + сравнение с прошлым периодом\n` +
  `📂 Экспорт CSV за неделю / месяц / квартал / год / всё время\n` +
  `↩️ Кнопка отмены под каждой транзакцией\n\n` +
  `💡 Жми меню или используй <code>/menu</code> в любой момент.`;

function welcomeKeyboard() {
  // Single combined keyboard: main menu + a "demo" button that seeds a couple of expenses.
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📅 Сегодня', 'menu:today'),
      Markup.button.callback('📊 Неделя', 'menu:week'),
      Markup.button.callback('📆 Месяц', 'menu:month'),
    ],
    [
      Markup.button.callback('🧠 AI-совет', 'menu:advice'),
      Markup.button.callback('📈 Стата', 'menu:stats'),
      Markup.button.callback('🎯 Цель', 'menu:goal'),
    ],
    [
      Markup.button.callback('💼 Бюджеты', 'menu:budget'),
      Markup.button.callback('🔁 Подписки', 'menu:subs'),
      Markup.button.callback('📜 История', 'menu:history:0'),
    ],
    [
      Markup.button.callback('🔎 Поиск', 'menu:search'),
      Markup.button.callback('📂 Экспорт', 'menu:export'),
      Markup.button.callback('⚙️ Настройки', 'menu:settings'),
    ],
    [Markup.button.callback('✨ Заполнить демо-данными', 'start:demo')],
    [Markup.button.callback('❓ Справка', 'menu:help')],
  ]);
}

export async function sendHelp(ctx: Context): Promise<void> {
  const opts = { parse_mode: 'HTML' as const, ...mainMenuKeyboard() };
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(WELCOME, opts);
      return;
    } catch {
      // fall through
    }
  }
  await ctx.reply(WELCOME, opts);
}

async function seedDemo(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  await getOrCreateUser(userId);
  const demo: { amount: number; type: 'expense' | 'income'; category: string; note: string }[] = [
    { amount: 850, type: 'expense', category: 'еда', note: 'продукты' },
    { amount: 350, type: 'expense', category: 'транспорт', note: 'такси' },
    { amount: 180, type: 'expense', category: 'кафе', note: 'кофе' },
    { amount: 650, type: 'expense', category: 'кафе', note: 'обед' },
    { amount: 1490, type: 'expense', category: 'развлечения', note: 'кино' },
    { amount: 599, type: 'expense', category: 'подписки', note: 'Netflix' },
    { amount: 85000, type: 'income', category: 'зарплата', note: 'аванс' },
  ];
  for (const t of demo) {
    await insertTransaction({
      userId,
      amount: rublesToKopecks(t.amount),
      type: t.type,
      category: t.category,
      note: t.note,
      rawText: `[demo] ${t.note}`,
    });
  }
}

export function registerStart(bot: Telegraf): void {
  bot.start(async (ctx: Context) => {
    if (ctx.from) {
      await upsertUser({
        id: ctx.from.id,
        username: ctx.from.username ?? null,
        first_name: ctx.from.first_name ?? null,
        language_code: ctx.from.language_code ?? null,
      });
    }
    await ctx.reply(WELCOME, {
      parse_mode: 'HTML',
      ...welcomeKeyboard(),
    });
  });

  bot.help(sendHelp);

  bot.action('start:demo', async (ctx) => {
    await ctx.answerCbQuery('✨ Заполняю…');
    try {
      await seedDemo(ctx);
      await ctx.reply(
        '✨ Готово. Я добавил несколько примеров трат и доход. Можешь сразу глянуть /menu → 📊 Неделя.',
        mainMenuKeyboard(),
      );
    } catch {
      await ctx.reply('Не удалось заполнить демо. Попробуй ещё раз позже.');
    }
  });
}
