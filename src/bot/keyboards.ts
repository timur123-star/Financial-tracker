import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';
import { CATEGORIES, categoryEmoji } from '../categories.js';

/** Main menu shown by /menu and as a "back" target. */
export function mainMenuKeyboard(): { reply_markup: InlineKeyboardMarkup } {
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
      Markup.button.callback('📥 Импорт', 'menu:import'),
    ],
    [
      Markup.button.callback('⚙️ Настройки', 'menu:settings'),
      Markup.button.callback('❓ Справка', 'menu:help'),
    ],
  ]);
}

/** Navigation keyboard with prev/next + menu. `dir` lets you jump to today (offset=0). */
export function periodNavKeyboard(
  kind: 'today' | 'week' | 'month',
  offset: number,
): { reply_markup: InlineKeyboardMarkup } {
  const row: ReturnType<typeof Markup.button.callback>[] = [];
  row.push(Markup.button.callback('◀ Назад', `nav:${kind}:${offset + 1}`));
  if (offset > 0) {
    row.push(Markup.button.callback('К текущей', `nav:${kind}:0`));
    row.push(Markup.button.callback('Вперёд ▶', `nav:${kind}:${offset - 1}`));
  }
  return Markup.inlineKeyboard([row, [Markup.button.callback('◀ Меню', 'menu:home')]]);
}

/** Stats period switcher. */
export function statsPeriodKeyboard(current: 'week' | 'month' | 'quarter' | 'year'): {
  reply_markup: InlineKeyboardMarkup;
} {
  const opts: [string, 'week' | 'month' | 'quarter' | 'year'][] = [
    ['Неделя', 'week'],
    ['Месяц', 'month'],
    ['Квартал', 'quarter'],
    ['Год', 'year'],
  ];
  const row = opts.map(([label, p]) =>
    Markup.button.callback(p === current ? `✨ ${label}` : label, `stats:${p}`),
  );
  return Markup.inlineKeyboard([row, [Markup.button.callback('◀ Меню', 'menu:home')]]);
}

/** Export period chooser. */
export function exportPeriodKeyboard(): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Неделя', 'export:week'),
      Markup.button.callback('Месяц', 'export:month'),
    ],
    [
      Markup.button.callback('Квартал', 'export:quarter'),
      Markup.button.callback('Год', 'export:year'),
    ],
    [Markup.button.callback('Всё время', 'export:all')],
    [Markup.button.callback('◀ Меню', 'menu:home')],
  ]);
}

/** Goal management. */
export function goalMenuKeyboard(hasGoal: boolean): { reply_markup: InlineKeyboardMarkup } {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [Markup.button.callback('🎯 Установить цель', 'goal:set')],
  ];
  if (hasGoal) {
    rows.push([Markup.button.callback('🗑 Снять цель', 'goal:del')]);
  }
  rows.push([Markup.button.callback('◀ Меню', 'menu:home')]);
  return Markup.inlineKeyboard(rows);
}

/** Suggested goal amounts as quick-pick buttons. */
export function goalAmountKeyboard(): { reply_markup: InlineKeyboardMarkup } {
  const presets = [20000, 30000, 50000, 80000, 100000, 150000, 200000, 300000];
  const buttons = presets.map((p) =>
    Markup.button.callback(p.toLocaleString('ru-RU'), `goal:set:${p}`),
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 4) rows.push(buttons.slice(i, i + 4));
  rows.push([Markup.button.callback('✏️ Своя сумма', 'goal:custom')]);
  rows.push([Markup.button.callback('✖️ Отмена', 'menu:goal')]);
  return Markup.inlineKeyboard(rows);
}

/** Subscriptions menu. */
export function subsMenuKeyboard(subs: { id: number; label: string; active: boolean }[]): {
  reply_markup: InlineKeyboardMarkup;
} {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [Markup.button.callback('➕ Добавить', 'subs:add')],
  ];
  for (const s of subs) {
    rows.push([
      Markup.button.callback(`${s.active ? '✅' : '⏸'} ${s.label}`, `subs:toggle:${s.id}`),
      Markup.button.callback('🗑', `subs:del:${s.id}`),
    ]);
  }
  rows.push([Markup.button.callback('◀ Меню', 'menu:home')]);
  return Markup.inlineKeyboard(rows);
}

/** Cadence picker for new subscription. */
export function cadencePickerKeyboard(): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Каждый день', 'subs:cad:daily'),
      Markup.button.callback('Каждую неделю', 'subs:cad:weekly'),
    ],
    [
      Markup.button.callback('Каждый месяц', 'subs:cad:monthly'),
      Markup.button.callback('Каждый год', 'subs:cad:yearly'),
    ],
    [Markup.button.callback('✖️ Отмена', 'subs:cancel')],
  ]);
}

export function backToMenuKeyboard(): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([[Markup.button.callback('◀ Меню', 'menu:home')]]);
}

export function transactionActionsKeyboard(
  undoToken: string,
  txIds: number[],
): {
  reply_markup: InlineKeyboardMarkup;
} {
  const buttons = [
    [
      Markup.button.callback(
        txIds.length > 1 ? `❌ Отменить (${txIds.length})` : '❌ Отменить',
        `undo:${undoToken}`,
      ),
    ],
  ];
  if (txIds.length === 1) {
    buttons[0].push(Markup.button.callback('✏️ Категория', `editcat:${txIds[0]}`));
  }
  buttons.push([Markup.button.callback('◀ Меню', 'menu:home')]);
  return Markup.inlineKeyboard(buttons);
}

/** Inline category picker. `action` is a prefix used in callback data, e.g. `setcat:42`. */
export function categoryPickerKeyboard(action: string): { reply_markup: InlineKeyboardMarkup } {
  const buttons = CATEGORIES.filter((c) => c !== 'зарплата').map((c) =>
    Markup.button.callback(`${categoryEmoji(c)} ${c}`, `${action}:${c}`),
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  rows.push([Markup.button.callback('✖️ Отмена', `${action}:cancel`)]);
  return Markup.inlineKeyboard(rows);
}

export function tzKeyboard(): { reply_markup: InlineKeyboardMarkup } {
  const zones: [string, string][] = [
    ['🇷🇺 Калининград (UTC+2)', 'Europe/Kaliningrad'],
    ['🇷🇺 Москва (UTC+3)', 'Europe/Moscow'],
    ['🇷🇺 Самара (UTC+4)', 'Europe/Samara'],
    ['🇷🇺 Екатеринбург (UTC+5)', 'Asia/Yekaterinburg'],
    ['🇷🇺 Омск (UTC+6)', 'Asia/Omsk'],
    ['🇷🇺 Новосибирск (UTC+7)', 'Asia/Novosibirsk'],
    ['🇷🇺 Красноярск (UTC+7)', 'Asia/Krasnoyarsk'],
    ['🇷🇺 Иркутск (UTC+8)', 'Asia/Irkutsk'],
    ['🇷🇺 Якутск (UTC+9)', 'Asia/Yakutsk'],
    ['🇷🇺 Владивосток (UTC+10)', 'Asia/Vladivostok'],
    ['🇰🇿 Алматы (UTC+5)', 'Asia/Almaty'],
    ['🇧🇾 Минск (UTC+3)', 'Europe/Minsk'],
    ['🇺🇦 Киев (UTC+2/+3)', 'Europe/Kyiv'],
    ['🇬🇪 Тбилиси (UTC+4)', 'Asia/Tbilisi'],
    ['🇹🇷 Стамбул (UTC+3)', 'Europe/Istanbul'],
  ];
  const rows = zones.map(([label, tz]) => [Markup.button.callback(label, `set:tz:${tz}`)]);
  rows.push([Markup.button.callback('◀ Назад', 'menu:settings')]);
  return Markup.inlineKeyboard(rows);
}

export function currencyKeyboard(): { reply_markup: InlineKeyboardMarkup } {
  const items: [string, string, string][] = [
    ['🇷🇺 RUB', 'RUB', '₽'],
    ['🇺🇸 USD', 'USD', '$'],
    ['🇪🇺 EUR', 'EUR', '€'],
    ['🇰🇿 KZT', 'KZT', '₸'],
    ['🇺🇦 UAH', 'UAH', '₴'],
    ['🇧🇾 BYN', 'BYN', 'Br'],
    ['🇬🇪 GEL', 'GEL', '₾'],
    ['🇹🇷 TRY', 'TRY', '₺'],
    ['🇬🇧 GBP', 'GBP', '£'],
    ['🇨🇳 CNY', 'CNY', '¥'],
  ];
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  const buttons = items.map(([label, code, symbol]) =>
    Markup.button.callback(label, `set:cur:${code}:${symbol}`),
  );
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([Markup.button.callback('◀ Назад', 'menu:settings')]);
  return Markup.inlineKeyboard(rows);
}

export function settingsKeyboard(notify: boolean): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🌍 Таймзона', 'settings:tz')],
    [Markup.button.callback('💱 Валюта', 'settings:cur')],
    [
      Markup.button.callback(
        notify ? '🔔 Уведомления: вкл' : '🔕 Уведомления: выкл',
        'settings:notify',
      ),
    ],
    [Markup.button.callback('◀ Меню', 'menu:home')],
  ]);
}

export function budgetMenuKeyboard(hasAny: boolean): { reply_markup: InlineKeyboardMarkup } {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [Markup.button.callback('➕ Установить', 'budget:add')],
  ];
  if (hasAny) {
    rows.push([Markup.button.callback('🗑 Удалить лимит', 'budget:del')]);
    rows.push([Markup.button.callback('♻️ Сбросить все', 'budget:reset')]);
  }
  rows.push([Markup.button.callback('◀ Меню', 'menu:home')]);
  return Markup.inlineKeyboard(rows);
}

/** Suggested amounts for budget — quick presets + custom input. */
export function budgetAmountKeyboard(category: string): { reply_markup: InlineKeyboardMarkup } {
  const presets = [3000, 5000, 10000, 15000, 20000, 30000, 50000, 100000];
  const buttons = presets.map((p) =>
    Markup.button.callback(`${p.toLocaleString('ru-RU')}`, `budget:set:${category}:${p}`),
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 4) rows.push(buttons.slice(i, i + 4));
  rows.push([Markup.button.callback('✏️ Своя сумма', `budget:custom:${category}`)]);
  rows.push([Markup.button.callback('✖️ Отмена', 'menu:budget')]);
  return Markup.inlineKeyboard(rows);
}

export function historyKeyboard(
  page: number,
  hasNext: boolean,
  txIds: number[],
): { reply_markup: InlineKeyboardMarkup } {
  const deleteButtons = txIds.map((id) => Markup.button.callback(`🗑 ${id}`, `delete:${id}`));
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < deleteButtons.length; i += 5) rows.push(deleteButtons.slice(i, i + 5));
  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) nav.push(Markup.button.callback('◀ Назад', `menu:history:${page - 1}`));
  if (hasNext) nav.push(Markup.button.callback('Далее ▶', `menu:history:${page + 1}`));
  if (nav.length > 0) rows.push(nav);
  rows.push([Markup.button.callback('◀ Меню', 'menu:home')]);
  return Markup.inlineKeyboard(rows);
}

export function confirmDeleteKeyboard(
  id: number,
  page: number,
): { reply_markup: InlineKeyboardMarkup } {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Да, удалить', `delconfirm:${id}:${page}`),
      Markup.button.callback('✖️ Нет', `menu:history:${page}`),
    ],
  ]);
}

export function categoryListPickerKeyboard(
  action: string,
  categories: readonly string[],
  cancelAction: string = 'menu:budget',
): { reply_markup: InlineKeyboardMarkup } {
  const buttons = categories.map((c) =>
    Markup.button.callback(`${categoryEmoji(c)} ${c}`, `${action}:${c}`),
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  rows.push([Markup.button.callback('✖️ Отмена', cancelAction)]);
  return Markup.inlineKeyboard(rows);
}
