export const CATEGORIES = [
  'еда',
  'транспорт',
  'жильё',
  'здоровье',
  'развлечения',
  'одежда',
  'кафе',
  'подписки',
  'зарплата',
  'прочее',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_EMOJI: Record<string, string> = {
  еда: '🛒',
  транспорт: '🚕',
  жильё: '🏠',
  здоровье: '💊',
  развлечения: '🎬',
  одежда: '👕',
  кафе: '☕',
  подписки: '📺',
  зарплата: '💰',
  прочее: '💸',
};

export const CATEGORY_COLOR: Record<string, string> = {
  еда: '#2ecc71',
  транспорт: '#3498db',
  жильё: '#e74c3c',
  здоровье: '#f39c12',
  развлечения: '#9b59b6',
  одежда: '#1abc9c',
  кафе: '#e67e22',
  подписки: '#34495e',
  зарплата: '#27ae60',
  прочее: '#7f8c8d',
};

export function normalizeCategory(input: string): Category {
  const v = (input ?? '').toLowerCase().trim();
  const direct = CATEGORIES.find((c) => c === v);
  if (direct) return direct;

  const aliases: Record<string, Category> = {
    продукты: 'еда',
    'продукты питания': 'еда',
    'еда и напитки': 'еда',
    food: 'еда',
    groceries: 'еда',
    такси: 'транспорт',
    метро: 'транспорт',
    бензин: 'транспорт',
    transport: 'транспорт',
    taxi: 'транспорт',
    аренда: 'жильё',
    квартира: 'жильё',
    жилье: 'жильё',
    коммуналка: 'жильё',
    жкх: 'жильё',
    rent: 'жильё',
    housing: 'жильё',
    аптека: 'здоровье',
    лекарства: 'здоровье',
    врач: 'здоровье',
    health: 'здоровье',
    кино: 'развлечения',
    игры: 'развлечения',
    развлечение: 'развлечения',
    entertainment: 'развлечения',
    'одежда и обувь': 'одежда',
    clothes: 'одежда',
    кофе: 'кафе',
    ресторан: 'кафе',
    обед: 'кафе',
    cafe: 'кафе',
    coffee: 'кафе',
    restaurant: 'кафе',
    подписка: 'подписки',
    spotify: 'подписки',
    netflix: 'подписки',
    subscription: 'подписки',
    subscriptions: 'подписки',
    зп: 'зарплата',
    salary: 'зарплата',
    доход: 'зарплата',
    income: 'зарплата',
    other: 'прочее',
    misc: 'прочее',
  };

  return aliases[v] ?? 'прочее';
}

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '💸';
}

export function categoryColor(category: string): string {
  return CATEGORY_COLOR[category] ?? '#95a5a6';
}
