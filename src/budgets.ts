import { pool } from './db.js';

export interface BudgetRow {
  user_id: number;
  category: string;
  limit_amt: number; // kopecks
  month: string; // YYYY-MM-DD (first of month)
}

export function monthStart(tz: string, when: Date = new Date()): Date {
  // Compute the local YYYY-MM in the user's tz, then take the 1st of that month at 00:00 UTC.
  // For aggregation purposes we use UTC ISO; precise tz alignment is handled at query time.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' });
  const parts = fmt.formatToParts(when);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return new Date(`${year}-${month}-01T00:00:00Z`);
}

export function nextMonthStart(tz: string, when: Date = new Date()): Date {
  const m = monthStart(tz, when);
  const y = m.getUTCFullYear();
  const mo = m.getUTCMonth();
  return new Date(Date.UTC(y, mo + 1, 1, 0, 0, 0));
}

export async function setBudget(
  userId: number,
  category: string,
  limitKopecks: number,
  month: Date,
): Promise<void> {
  await pool.query(
    `INSERT INTO budgets (user_id, category, limit_amt, month)
     VALUES ($1, $2, $3, $4::date)
     ON CONFLICT (user_id, category, month)
     DO UPDATE SET limit_amt = EXCLUDED.limit_amt`,
    [userId, category, limitKopecks, month.toISOString().slice(0, 10)],
  );
}

export async function listBudgets(userId: number, month: Date): Promise<BudgetRow[]> {
  const { rows } = await pool.query<{
    user_id: number;
    category: string;
    limit_amt: string;
    month: string;
  }>(
    `SELECT user_id, category, limit_amt::bigint::text AS limit_amt, to_char(month, 'YYYY-MM-DD') AS month
       FROM budgets
       WHERE user_id = $1 AND month = $2::date
       ORDER BY category`,
    [userId, month.toISOString().slice(0, 10)],
  );
  return rows.map((r) => ({
    user_id: r.user_id,
    category: r.category,
    limit_amt: Number(r.limit_amt),
    month: r.month,
  }));
}

export async function getBudget(
  userId: number,
  category: string,
  month: Date,
): Promise<BudgetRow | null> {
  const { rows } = await pool.query<{
    user_id: number;
    category: string;
    limit_amt: string;
    month: string;
  }>(
    `SELECT user_id, category, limit_amt::bigint::text AS limit_amt, to_char(month, 'YYYY-MM-DD') AS month
       FROM budgets
       WHERE user_id = $1 AND category = $2 AND month = $3::date`,
    [userId, category, month.toISOString().slice(0, 10)],
  );
  if (!rows[0]) return null;
  return {
    user_id: rows[0].user_id,
    category: rows[0].category,
    limit_amt: Number(rows[0].limit_amt),
    month: rows[0].month,
  };
}

export async function getMonthSpentByCategory(
  userId: number,
  category: string,
  monthStartDate: Date,
  nextMonthStartDate: Date,
): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::bigint::text AS total
       FROM transactions
       WHERE user_id = $1
         AND category = $2
         AND type = 'expense'
         AND created_at >= $3
         AND created_at < $4`,
    [userId, category, monthStartDate.toISOString(), nextMonthStartDate.toISOString()],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function deleteBudget(
  userId: number,
  category: string,
  month: Date,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM budgets WHERE user_id = $1 AND category = $2 AND month = $3::date`,
    [userId, category, month.toISOString().slice(0, 10)],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteAllBudgets(userId: number, month: Date): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM budgets WHERE user_id = $1 AND month = $2::date`,
    [userId, month.toISOString().slice(0, 10)],
  );
  return rowCount ?? 0;
}
