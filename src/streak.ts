import { pool } from './db.js';

/**
 * How many days in a row (counting back from today) had at least one transaction?
 * "Today" is computed in the user's tz; if today has none, the streak ends "yesterday".
 */
export async function computeStreak(userId: number, tz: string, maxDays = 365): Promise<number> {
  const { rows } = await pool.query<{ d: string }>(
    `SELECT DISTINCT (created_at AT TIME ZONE $2)::date::text AS d
       FROM transactions
       WHERE user_id = $1
       ORDER BY d DESC
       LIMIT $3`,
    [userId, tz, maxDays],
  );
  if (rows.length === 0) return 0;

  // What is "today" in the user's tz?
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // YYYY-MM-DD

  const set = new Set(rows.map((r) => r.d));
  let cursor = todayStr;
  let streak = 0;
  let attempts = 0;

  // If today has no entries, allow streak to start from yesterday.
  if (!set.has(cursor)) {
    cursor = subtractDay(cursor);
  }

  while (set.has(cursor) && attempts < maxDays) {
    streak += 1;
    cursor = subtractDay(cursor);
    attempts += 1;
  }
  return streak;
}

function subtractDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
