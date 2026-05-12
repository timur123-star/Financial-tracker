/**
 * Compute "today" / "this week" / "this month" boundaries in the user's timezone,
 * returned as UTC Date instances suitable for `created_at >= ? AND created_at < ?` queries.
 *
 * Week starts on Monday (Russian convention).
 */

function tzOffsetMinutes(tz: string, when: Date): number {
  // Format the date in the target tz and parse back to compute offset.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(when);
  const g = (t: string): string => parts.find((p) => p.type === t)?.value ?? '0';
  const y = Number(g('year'));
  const m = Number(g('month'));
  const d = Number(g('day'));
  const h = Number(g('hour') === '24' ? '0' : g('hour'));
  const mi = Number(g('minute'));
  const s = Number(g('second'));
  const asUtc = Date.UTC(y, m - 1, d, h, mi, s);
  return Math.round((asUtc - when.getTime()) / 60_000);
}

function localComponents(
  tz: string,
  when: Date,
): { y: number; m: number; d: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(when);
  const g = (t: string): string => parts.find((p) => p.type === t)?.value ?? '0';
  return {
    y: Number(g('year')),
    m: Number(g('month')),
    d: Number(g('day')),
    h: Number(g('hour') === '24' ? '0' : g('hour')),
    min: Number(g('minute')),
  };
}

/** Returns a UTC Date representing the given local Y/M/D 00:00 in the given timezone. */
function fromLocalDate(tz: string, y: number, m: number, d: number): Date {
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0);
  const probe = new Date(naive);
  const offset = tzOffsetMinutes(tz, probe);
  return new Date(naive - offset * 60_000);
}

export function startOfDay(tz: string, when: Date = new Date()): Date {
  const { y, m, d } = localComponents(tz, when);
  return fromLocalDate(tz, y, m, d);
}

export function endOfDay(tz: string, when: Date = new Date()): Date {
  const start = startOfDay(tz, when);
  return new Date(start.getTime() + 24 * 3600 * 1000);
}

/** Monday 00:00 local of the week containing `when`. */
export function startOfWeek(tz: string, when: Date = new Date()): Date {
  const start = startOfDay(tz, when);
  // Get the local weekday (1..7, Monday=1) by formatting again.
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(start);
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const idx = order.indexOf(wd);
  const diff = idx < 0 ? 0 : idx;
  return new Date(start.getTime() - diff * 24 * 3600 * 1000);
}

export function startOfMonth(tz: string, when: Date = new Date()): Date {
  const { y, m } = localComponents(tz, when);
  return fromLocalDate(tz, y, m, 1);
}

export function nextDay(d: Date): Date {
  return new Date(d.getTime() + 24 * 3600 * 1000);
}

export function nextWeek(d: Date): Date {
  return new Date(d.getTime() + 7 * 24 * 3600 * 1000);
}

export function nextMonth(tz: string, anchor: Date): Date {
  const { y, m } = localComponents(tz, anchor);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return fromLocalDate(tz, nextY, nextM, 1);
}

export function previousWeekRange(tz: string, when: Date = new Date()): { from: Date; to: Date } {
  const thisStart = startOfWeek(tz, when);
  const from = new Date(thisStart.getTime() - 7 * 24 * 3600 * 1000);
  return { from, to: thisStart };
}

export function formatLocalDate(tz: string, when: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(when);
}

export function formatLocalDateTime(tz: string, when: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(when);
}

/** Previous day at 00:00 local in tz. */
export function previousDay(tz: string, anchor: Date): Date {
  const start = startOfDay(tz, anchor);
  return new Date(start.getTime() - 24 * 3600 * 1000);
}

/** Previous week's Monday 00:00 local in tz. */
export function previousWeek(tz: string, anchor: Date): Date {
  const start = startOfWeek(tz, anchor);
  return new Date(start.getTime() - 7 * 24 * 3600 * 1000);
}

/** Previous month's 1st 00:00 local in tz. */
export function previousMonth(tz: string, anchor: Date): Date {
  const start = startOfMonth(tz, anchor);
  // step back into prev month and round
  const back = new Date(start.getTime() - 24 * 3600 * 1000);
  return startOfMonth(tz, back);
}

/** Start of the quarter containing `when` (months 1/4/7/10). */
export function startOfQuarter(tz: string, when: Date = new Date()): Date {
  const { y, m } = localComponents(tz, when);
  const qm = m - ((m - 1) % 3);
  return fromLocalDate(tz, y, qm, 1);
}

/** End-exclusive: start of the next quarter. */
export function nextQuarter(tz: string, anchor: Date): Date {
  const { y, m } = localComponents(tz, anchor);
  const qm = m - ((m - 1) % 3);
  let ny = y;
  let nm = qm + 3;
  if (nm > 12) {
    nm -= 12;
    ny += 1;
  }
  return fromLocalDate(tz, ny, nm, 1);
}

/** Start of the year containing `when`. */
export function startOfYear(tz: string, when: Date = new Date()): Date {
  const { y } = localComponents(tz, when);
  return fromLocalDate(tz, y, 1, 1);
}

/** End-exclusive: start of the next year. */
export function nextYear(tz: string, anchor: Date): Date {
  const { y } = localComponents(tz, anchor);
  return fromLocalDate(tz, y + 1, 1, 1);
}

export function formatMonthName(tz: string, when: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    month: 'long',
    year: 'numeric',
  }).format(when);
}

export function formatShortDay(tz: string, when: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(when);
}

/** Human-friendly label for a (from, to) range in the user's locale. */
export function formatRangeLabel(tz: string, from: Date, to: Date): string {
  const a = formatLocalDate(tz, from);
  const b = formatLocalDate(tz, new Date(to.getTime() - 1));
  return `${a} — ${b}`;
}
