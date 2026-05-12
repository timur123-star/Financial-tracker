import { pool } from './db.js';
import { monthStart, nextMonthStart } from './budgets.js';

export interface GoalRow {
  user_id: number;
  month: string; // YYYY-MM-DD
  target_amt: number; // kopecks
}

export async function setGoal(userId: number, tz: string, targetKopecks: number): Promise<void> {
  const ms = monthStart(tz);
  await pool.query(
    `INSERT INTO goals (user_id, month, target_amt)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (user_id, month) DO UPDATE
       SET target_amt = EXCLUDED.target_amt, updated_at = now()`,
    [userId, ms.toISOString().slice(0, 10), targetKopecks],
  );
}

export async function deleteGoal(userId: number, tz: string): Promise<boolean> {
  const ms = monthStart(tz);
  const { rowCount } = await pool.query(
    `DELETE FROM goals WHERE user_id = $1 AND month = $2::date`,
    [userId, ms.toISOString().slice(0, 10)],
  );
  return (rowCount ?? 0) > 0;
}

export async function getCurrentGoal(userId: number, tz: string): Promise<GoalRow | null> {
  const ms = monthStart(tz);
  const { rows } = await pool.query<{ user_id: number; month: string; target_amt: string }>(
    `SELECT user_id, to_char(month, 'YYYY-MM-DD') AS month, target_amt::bigint::text AS target_amt
       FROM goals
       WHERE user_id = $1 AND month = $2::date`,
    [userId, ms.toISOString().slice(0, 10)],
  );
  if (!rows[0]) return null;
  return {
    user_id: rows[0].user_id,
    month: rows[0].month,
    target_amt: Number(rows[0].target_amt),
  };
}

/** Returns { from, to } pair for "this month" — convenience re-export. */
export function currentMonthRange(tz: string): { from: Date; to: Date } {
  return { from: monthStart(tz), to: nextMonthStart(tz) };
}
