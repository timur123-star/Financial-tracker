import {
  biggestExpense,
  getDailyExpenses,
  getRangeByCategory,
  getRangeTotals,
  type CategoryTotal,
} from '../../transactions.js';
import { getOrCreateUser, type UserRow } from '../../users.js';
import { categoryEmoji } from '../../categories.js';
import { capitalize, escapeHtml, formatAmount, kopecksToRubles } from '../../format.js';
import {
  formatLocalDate,
  formatMonthName,
  formatRangeLabel,
  nextMonth,
  nextQuarter,
  nextWeek,
  nextYear,
  previousMonth,
  previousWeek,
  previousWeekRange,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from '../../time.js';
import { renderCategoryDonut, renderDailyBar, renderEmpty } from '../../chart.js';
import { computeStreak } from '../../streak.js';
import { getCurrentGoal } from '../../goals.js';

export interface ReportPayload {
  caption: string;
  photo?: Buffer;
}

// --- DAY ---

/** "Today" or a specific historical day. `offset` = how many days back from today. */
export async function buildDayReport(userId: number, offset: number): Promise<ReportPayload> {
  const user = await getOrCreateUser(userId);
  const today = startOfDay(user.tz);
  const anchor = new Date(today.getTime() - offset * 24 * 3600 * 1000);
  const from = anchor;
  const to = new Date(from.getTime() + 24 * 3600 * 1000);

  const [byCat, totals] = await Promise.all([
    getRangeByCategory({ userId, tz: user.tz, from, to }),
    getRangeTotals({ userId, tz: user.tz, from, to }),
  ]);

  const dateLabel = formatLocalDate(user.tz, from);
  const header =
    offset === 0
      ? `📅 <b>Сегодня — ${escapeHtml(dateLabel)}</b>`
      : `📅 <b>${escapeHtml(dateLabel)}</b>`;

  if (totals.count === 0) {
    return {
      caption:
        `${header}\n\n` +
        (offset === 0
          ? '🌤 Записей пока нет.\nНапиши, например: <code>такси 350</code> или <code>обед 450, кофе 180</code>.'
          : '📭 В этот день записей не было.'),
    };
  }

  const lines = byCat.map(
    (c) =>
      `${categoryEmoji(c.category)} <b>${escapeHtml(capitalize(c.category))}</b> · ` +
      `${escapeHtml(formatAmount(c.total, user.currency_symbol))}` +
      (c.count > 1 ? ` <i>×${c.count}</i>` : ''),
  );

  const totalLine =
    `\n💸 Расходы: <b>${escapeHtml(formatAmount(totals.expense, user.currency_symbol))}</b>` +
    (totals.income > 0
      ? `\n💰 Доходы: <b>${escapeHtml(formatAmount(totals.income, user.currency_symbol))}</b>`
      : '');

  return { caption: `${header}${totalLine}\n\n${lines.join('\n')}` };
}

// --- WEEK ---

export async function buildWeekReport(userId: number, offset: number): Promise<ReportPayload> {
  const user = await getOrCreateUser(userId);
  let from = startOfWeek(user.tz);
  for (let i = 0; i < offset; i++) from = previousWeek(user.tz, from);
  const to = nextWeek(from);

  const [byCat, totals, daily] = await Promise.all([
    getRangeByCategory({ userId, tz: user.tz, from, to }),
    getRangeTotals({ userId, tz: user.tz, from, to }),
    getDailyExpenses({ userId, tz: user.tz, from, to }),
  ]);

  const title = `Расходы за неделю · ${formatRangeLabel(user.tz, from, to)}`;

  if (totals.expense === 0) {
    const empty = await renderEmpty(title);
    return {
      caption:
        offset === 0
          ? '📭 <b>За эту неделю трат пока нет.</b>\nЗаписывай по ходу дня — в воскресенье 20:00 пришлю отчёт с AI-советами.'
          : `📭 <b>На этой неделе трат не было.</b>\n<i>${escapeHtml(formatRangeLabel(user.tz, from, to))}</i>`,
      photo: empty,
    };
  }

  const chart = await renderCategoryDonut(title, byCat, totals.expense, user.currency_symbol);
  const lines = byCat.slice(0, 8).map((c) => formatCategoryLine(c, totals.expense, user));
  const caption =
    `📊 <b>${offset === 0 ? 'Текущая неделя' : 'Неделя'}</b> · ` +
    `${escapeHtml(formatRangeLabel(user.tz, from, to))}\n` +
    `Итого: <b>${escapeHtml(formatAmount(totals.expense, user.currency_symbol))}</b> · ` +
    `${totals.count} записей` +
    (totals.income > 0
      ? `\n💰 Доход: ${escapeHtml(formatAmount(totals.income, user.currency_symbol))}`
      : '') +
    `\n\n${lines.join('\n')}`;

  // Daily dynamics chart goes as a follow-up payload, embedded via caption marker.
  void daily;
  return { caption, photo: chart };
}

/** Optional second-pass bar chart for the week (sent separately to keep file count low). */
export async function buildWeekBarChart(userId: number, offset: number): Promise<Buffer | null> {
  const user = await getOrCreateUser(userId);
  let from = startOfWeek(user.tz);
  for (let i = 0; i < offset; i++) from = previousWeek(user.tz, from);
  const to = nextWeek(from);
  const daily = await getDailyExpenses({ userId, tz: user.tz, from, to });
  if (daily.length === 0 || daily.every((d) => d.total === 0)) return null;
  // Fill missing days with zeros so the bar chart shows a full week.
  const map = new Map(daily.map((d) => [d.day, d.total]));
  const filled: { day: string; total: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getTime() + i * 24 * 3600 * 1000);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: user.tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(d);
    const ds = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
    filled.push({ day: ds, total: map.get(ds) ?? 0 });
  }
  return await renderDailyBar(`Динамика по дням`, filled, user.currency_symbol);
}

// --- MONTH ---

export async function buildMonthReport(userId: number, offset: number): Promise<ReportPayload> {
  const user = await getOrCreateUser(userId);
  let from = startOfMonth(user.tz);
  for (let i = 0; i < offset; i++) from = previousMonth(user.tz, from);
  const to = nextMonth(user.tz, from);

  const [byCat, totals] = await Promise.all([
    getRangeByCategory({ userId, tz: user.tz, from, to }),
    getRangeTotals({ userId, tz: user.tz, from, to }),
  ]);

  const monthLabel = capitalize(formatMonthName(user.tz, from));
  const title = `Расходы за ${monthLabel}`;

  if (totals.expense === 0) {
    const empty = await renderEmpty(title);
    return {
      caption: `📭 <b>В ${escapeHtml(monthLabel.toLowerCase())} трат пока нет.</b>`,
      photo: empty,
    };
  }

  const chart = await renderCategoryDonut(title, byCat, totals.expense, user.currency_symbol);
  const lines = byCat.slice(0, 10).map((c) => formatCategoryLine(c, totals.expense, user));
  const incomeLine =
    totals.income > 0
      ? `\n💰 Доходы: <b>${escapeHtml(formatAmount(totals.income, user.currency_symbol))}</b>`
      : '';

  // Goal status (only for current month — we don't keep per-historic-month goals).
  let goalLine = '';
  if (offset === 0) {
    const goal = await getCurrentGoal(userId, user.tz);
    if (goal && goal.target_amt > 0) {
      const pct = (totals.expense / goal.target_amt) * 100;
      const left = goal.target_amt - totals.expense;
      const marker = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      goalLine =
        `\n🎯 Цель: ${escapeHtml(formatAmount(goal.target_amt, user.currency_symbol))} ` +
        `· потрачено <b>${pct.toFixed(0)}%</b> ${marker}` +
        (left > 0
          ? ` · осталось <b>${escapeHtml(formatAmount(left, user.currency_symbol))}</b>`
          : '');
    }
  }

  const caption =
    `📊 <b>${escapeHtml(monthLabel)}</b>\n` +
    `Расходы: <b>${escapeHtml(formatAmount(totals.expense, user.currency_symbol))}</b> · ` +
    `${totals.count} записей${incomeLine}${goalLine}\n\n${lines.join('\n')}`;

  return { caption, photo: chart };
}

// --- QUARTER / YEAR ---

export async function buildQuarterReport(userId: number, offset: number): Promise<ReportPayload> {
  const user = await getOrCreateUser(userId);
  let from = startOfQuarter(user.tz);
  for (let i = 0; i < offset; i++) {
    const back = new Date(from.getTime() - 24 * 3600 * 1000);
    from = startOfQuarter(user.tz, back);
  }
  const to = nextQuarter(user.tz, from);
  return buildPeriodReport(userId, user, from, to, 'квартал');
}

export async function buildYearReport(userId: number, offset: number): Promise<ReportPayload> {
  const user = await getOrCreateUser(userId);
  let from = startOfYear(user.tz);
  for (let i = 0; i < offset; i++) {
    const back = new Date(from.getTime() - 24 * 3600 * 1000);
    from = startOfYear(user.tz, back);
  }
  const to = nextYear(user.tz, from);
  return buildPeriodReport(userId, user, from, to, 'год');
}

async function buildPeriodReport(
  userId: number,
  user: UserRow,
  from: Date,
  to: Date,
  label: string,
): Promise<ReportPayload> {
  const [byCat, totals] = await Promise.all([
    getRangeByCategory({ userId, tz: user.tz, from, to }),
    getRangeTotals({ userId, tz: user.tz, from, to }),
  ]);
  const range = formatRangeLabel(user.tz, from, to);
  const title = `Расходы за ${label} · ${range}`;
  if (totals.expense === 0) {
    return {
      caption: `📭 <b>За ${escapeHtml(label)} трат нет.</b>\n<i>${escapeHtml(range)}</i>`,
      photo: await renderEmpty(title),
    };
  }
  const chart = await renderCategoryDonut(title, byCat, totals.expense, user.currency_symbol);
  const lines = byCat.slice(0, 10).map((c) => formatCategoryLine(c, totals.expense, user));
  const incomeLine =
    totals.income > 0
      ? `\n💰 Доходы: <b>${escapeHtml(formatAmount(totals.income, user.currency_symbol))}</b>`
      : '';
  const caption =
    `📊 <b>За ${escapeHtml(label)}</b> · ${escapeHtml(range)}\n` +
    `Расходы: <b>${escapeHtml(formatAmount(totals.expense, user.currency_symbol))}</b> · ` +
    `${totals.count} записей${incomeLine}\n\n${lines.join('\n')}`;
  return { caption, photo: chart };
}

function formatCategoryLine(c: CategoryTotal, total: number, user: UserRow): string {
  const pct = total > 0 ? (c.total / total) * 100 : 0;
  return (
    `${categoryEmoji(c.category)} <b>${escapeHtml(capitalize(c.category))}</b> · ` +
    `${escapeHtml(formatAmount(c.total, user.currency_symbol))} ` +
    `<i>(${pct.toFixed(0)}%)</i>`
  );
}

// --- STATS ---

export interface MonthStats {
  thisExpense: number;
  prevExpense: number;
  thisIncome: number;
  thisCount: number;
  daysActive: number;
  avgPerDay: number;
  biggest: { amount: number; category: string; note: string | null } | null;
  topCategories: CategoryTotal[];
  streak: number;
  goalTarget: number | null;
  goalPct: number | null;
  /**
   * Linear projection of total spend for the current period at the present
   * pace. Computed only when at least one full day has elapsed and the period
   * has at least one day remaining. `null` otherwise.
   */
  forecast: number | null;
  daysElapsed: number;
  daysTotal: number;
}

export type StatsPeriod = 'week' | 'month' | 'quarter' | 'year';

export async function buildStats(
  userId: number,
  period: StatsPeriod = 'month',
): Promise<{ caption: string; data: MonthStats }> {
  const user = await getOrCreateUser(userId);

  // Resolve current + previous period of the same type.
  const { from, to, prevFrom, prevTo, label } = resolvePeriod(user.tz, period);

  const [thisTotals, prevTotals, thisCats, biggest, streak, daily, goal] = await Promise.all([
    getRangeTotals({ userId, tz: user.tz, from, to }),
    getRangeTotals({ userId, tz: user.tz, from: prevFrom, to: prevTo }),
    getRangeByCategory({ userId, tz: user.tz, from, to }),
    biggestExpense(userId, from, to),
    computeStreak(userId, user.tz),
    getDailyExpenses({ userId, tz: user.tz, from, to }),
    period === 'month' ? getCurrentGoal(userId, user.tz) : Promise.resolve(null),
  ]);

  const daysActive = daily.filter((d) => d.total > 0).length;
  const avgPerDay = daysActive > 0 ? thisTotals.expense / daysActive : 0;

  // Linear forecast: scale current spend by daysTotal/daysElapsed. Only
  // meaningful once we have at least half a day of data and at least one day
  // remaining in the period.
  const now = new Date();
  const startMs = from.getTime();
  const endMs = to.getTime();
  const periodMs = endMs - startMs;
  const elapsedMs = Math.min(Math.max(now.getTime() - startMs, 0), periodMs);
  const daysTotal = Math.max(Math.round(periodMs / (24 * 3600 * 1000)), 1);
  const daysElapsedFractional = elapsedMs / (24 * 3600 * 1000);
  const daysElapsed = Math.max(Math.floor(daysElapsedFractional), 0);
  const forecast =
    daysElapsedFractional >= 0.5 && daysElapsedFractional < daysTotal && thisTotals.expense > 0
      ? Math.round(thisTotals.expense * (daysTotal / daysElapsedFractional))
      : null;

  const data: MonthStats = {
    thisExpense: thisTotals.expense,
    prevExpense: prevTotals.expense,
    thisIncome: thisTotals.income,
    thisCount: thisTotals.count,
    daysActive,
    avgPerDay,
    biggest,
    topCategories: thisCats.slice(0, 3),
    streak,
    goalTarget: goal?.target_amt ?? null,
    goalPct: goal && goal.target_amt > 0 ? (thisTotals.expense / goal.target_amt) * 100 : null,
    forecast,
    daysElapsed,
    daysTotal,
  };

  const symbol = user.currency_symbol;
  const delta =
    data.prevExpense === 0
      ? null
      : ((data.thisExpense - data.prevExpense) / data.prevExpense) * 100;
  const deltaLine =
    delta === null
      ? `<i>${escapeHtml(label.prevEmptyHint)}</i>`
      : `${delta >= 0 ? '🔺' : '🔻'} ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}% ` +
        `<i>(${escapeHtml(label.prevLabel)}: ${escapeHtml(formatAmount(data.prevExpense, symbol))})</i>`;

  const top = data.topCategories
    .map((c, i) => {
      const pct = data.thisExpense > 0 ? (c.total / data.thisExpense) * 100 : 0;
      const medal = ['🥇', '🥈', '🥉'][i] ?? '•';
      return (
        `${medal} ${categoryEmoji(c.category)} <b>${escapeHtml(capitalize(c.category))}</b> · ` +
        `${escapeHtml(formatAmount(c.total, symbol))} <i>(${pct.toFixed(0)}%)</i>`
      );
    })
    .join('\n');

  const biggestLine = data.biggest
    ? `💥 Самая крупная: <b>${escapeHtml(formatAmount(data.biggest.amount, symbol))}</b> ` +
      `· ${categoryEmoji(data.biggest.category)} ${escapeHtml(capitalize(data.biggest.category))}` +
      (data.biggest.note ? ` <i>(${escapeHtml(data.biggest.note)})</i>` : '')
    : '';

  const streakLine =
    data.streak > 0
      ? `🔥 Серия: <b>${data.streak} ${plural(data.streak, ['день', 'дня', 'дней'])} подряд</b>`
      : '';

  const goalLine =
    data.goalTarget && data.goalPct !== null
      ? `🎯 Цель: <b>${escapeHtml(formatAmount(data.goalTarget, symbol))}</b> · ` +
        `${data.goalPct.toFixed(0)}% ` +
        (data.goalPct >= 100 ? '🚨' : data.goalPct >= 80 ? '⚠️' : '✅')
      : '';

  // Forecast line — projection to end of period + delta vs goal.
  let forecastLine = '';
  if (data.forecast !== null) {
    const goalIcon =
      data.goalTarget !== null
        ? data.forecast > data.goalTarget
          ? ' 🚨'
          : data.forecast > data.goalTarget * 0.9
            ? ' ⚠️'
            : ' ✅'
        : '';
    forecastLine =
      `🔮 Прогноз на ${escapeHtml(label.titleSuffix)}: ` +
      `<b>${escapeHtml(formatAmount(data.forecast, symbol))}</b>${goalIcon}` +
      ` · <i>${data.daysElapsed}/${data.daysTotal} дн.</i>`;
  }

  const lines = [
    `📊 <b>Статистика · ${escapeHtml(label.titleSuffix)}</b>`,
    `<i>${escapeHtml(label.range)}</i>`,
    ``,
    `💸 Расходы: <b>${escapeHtml(formatAmount(data.thisExpense, symbol))}</b>`,
    deltaLine,
    data.thisIncome > 0
      ? `💰 Доходы: <b>${escapeHtml(formatAmount(data.thisIncome, symbol))}</b>`
      : '',
    `📅 Активных дней: <b>${data.daysActive}</b> · записей: <b>${data.thisCount}</b>`,
    daysActive > 0
      ? `📈 В среднем в день: <b>${escapeHtml(formatAmount(Math.round(data.avgPerDay), symbol))}</b>`
      : '',
    streakLine,
    goalLine,
    forecastLine,
    biggestLine,
    top ? `\n<b>Топ категории:</b>\n${top}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { caption: lines, data };
}

interface PeriodInfo {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  label: {
    titleSuffix: string;
    range: string;
    prevLabel: string;
    prevEmptyHint: string;
  };
}

function resolvePeriod(tz: string, period: StatsPeriod): PeriodInfo {
  if (period === 'week') {
    const from = startOfWeek(tz);
    const to = nextWeek(from);
    const prevFrom = previousWeek(tz, from);
    const prevTo = from;
    return {
      from,
      to,
      prevFrom,
      prevTo,
      label: {
        titleSuffix: 'неделя',
        range: formatRangeLabel(tz, from, to),
        prevLabel: 'прошлая неделя',
        prevEmptyHint: 'на прошлой неделе трат не было',
      },
    };
  }
  if (period === 'quarter') {
    const from = startOfQuarter(tz);
    const to = nextQuarter(tz, from);
    const back = new Date(from.getTime() - 24 * 3600 * 1000);
    const prevFrom = startOfQuarter(tz, back);
    const prevTo = from;
    return {
      from,
      to,
      prevFrom,
      prevTo,
      label: {
        titleSuffix: 'квартал',
        range: formatRangeLabel(tz, from, to),
        prevLabel: 'прошлый квартал',
        prevEmptyHint: 'в прошлом квартале трат не было',
      },
    };
  }
  if (period === 'year') {
    const from = startOfYear(tz);
    const to = nextYear(tz, from);
    const back = new Date(from.getTime() - 24 * 3600 * 1000);
    const prevFrom = startOfYear(tz, back);
    const prevTo = from;
    return {
      from,
      to,
      prevFrom,
      prevTo,
      label: {
        titleSuffix: 'год',
        range: formatRangeLabel(tz, from, to),
        prevLabel: 'прошлый год',
        prevEmptyHint: 'в прошлом году трат не было',
      },
    };
  }
  // default — month
  const from = startOfMonth(tz);
  const to = nextMonth(tz, from);
  const prevFrom = previousMonth(tz, from);
  const prevTo = from;
  return {
    from,
    to,
    prevFrom,
    prevTo,
    label: {
      titleSuffix: capitalize(formatMonthName(tz, from)),
      range: formatRangeLabel(tz, from, to),
      prevLabel: 'прошлый месяц',
      prevEmptyHint: 'в прошлом месяце трат не было',
    },
  };
}

function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

export { kopecksToRubles, previousWeekRange };
