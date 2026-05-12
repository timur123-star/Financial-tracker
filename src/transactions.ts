import { pool } from './db.js';

export interface TxRow {
  id: number;
  user_id: number;
  amount: number; // kopecks
  type: 'expense' | 'income';
  category: string;
  note: string | null;
  raw_text: string | null;
  created_at: Date;
}

export interface CategoryTotal {
  category: string;
  total: number; // kopecks
  count: number;
}

export interface DayTotals {
  expense: number; // kopecks
  income: number; // kopecks
  count: number;
}

export async function insertTransaction(input: {
  userId: number;
  amount: number; // kopecks
  type: 'expense' | 'income';
  category: string;
  note?: string | null;
  rawText?: string | null;
  /** Optional historical timestamp (e.g. when importing a CSV). */
  occurredAt?: Date | null;
}): Promise<TxRow> {
  const { rows } = await pool.query<TxRow>(
    input.occurredAt
      ? `INSERT INTO transactions (user_id, amount, type, category, note, raw_text, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at`
      : `INSERT INTO transactions (user_id, amount, type, category, note, raw_text)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at`,
    input.occurredAt
      ? [
          input.userId,
          input.amount,
          input.type,
          input.category,
          input.note ?? null,
          input.rawText ?? null,
          input.occurredAt,
        ]
      : [
          input.userId,
          input.amount,
          input.type,
          input.category,
          input.note ?? null,
          input.rawText ?? null,
        ],
  );
  const r = rows[0] as unknown as TxRow & { amount: string };
  return { ...r, amount: Number(r.amount) };
}

export async function deleteTransaction(userId: number, id: number): Promise<TxRow | null> {
  const { rows } = await pool.query<TxRow>(
    `DELETE FROM transactions WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at`,
    [id, userId],
  );
  if (!rows[0]) return null;
  const r = rows[0] as unknown as TxRow & { amount: string };
  return { ...r, amount: Number(r.amount) };
}

export async function getDayTotals(
  userId: number,
  tz: string,
  when: Date = new Date(),
): Promise<DayTotals> {
  const { rows } = await pool.query<{ expense: string; income: string; count: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0)::bigint::text AS expense,
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0)::bigint::text AS income,
       COUNT(*)::text AS count
     FROM transactions
     WHERE user_id = $1
       AND (created_at AT TIME ZONE $2)::date = ($3 AT TIME ZONE $2)::date`,
    [userId, tz, when],
  );
  const r = rows[0];
  return {
    expense: Number(r?.expense ?? 0),
    income: Number(r?.income ?? 0),
    count: Number(r?.count ?? 0),
  };
}

export async function getDayByCategory(
  userId: number,
  tz: string,
  when: Date = new Date(),
): Promise<CategoryTotal[]> {
  const { rows } = await pool.query<{ category: string; total: string; count: string }>(
    `SELECT category, SUM(amount)::bigint::text AS total, COUNT(*)::text AS count
       FROM transactions
       WHERE user_id = $1
         AND type = 'expense'
         AND (created_at AT TIME ZONE $2)::date = ($3 AT TIME ZONE $2)::date
       GROUP BY category
       ORDER BY SUM(amount) DESC`,
    [userId, tz, when],
  );
  return rows.map((r) => ({
    category: r.category,
    total: Number(r.total),
    count: Number(r.count),
  }));
}

interface PeriodOpts {
  userId: number;
  tz: string;
  /** Lower bound — inclusive, in user-local tz. ISO string or Date. */
  from: Date;
  /** Upper bound — exclusive. */
  to: Date;
}

export async function getRangeByCategory(opts: PeriodOpts): Promise<CategoryTotal[]> {
  const { rows } = await pool.query<{ category: string; total: string; count: string }>(
    `SELECT category, SUM(amount)::bigint::text AS total, COUNT(*)::text AS count
       FROM transactions
       WHERE user_id = $1
         AND type = 'expense'
         AND created_at >= $2 AND created_at < $3
       GROUP BY category
       ORDER BY SUM(amount) DESC`,
    [opts.userId, opts.from.toISOString(), opts.to.toISOString()],
  );
  return rows.map((r) => ({
    category: r.category,
    total: Number(r.total),
    count: Number(r.count),
  }));
}

export async function getRangeTotals(opts: PeriodOpts): Promise<DayTotals> {
  const { rows } = await pool.query<{ expense: string; income: string; count: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0)::bigint::text AS expense,
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0)::bigint::text AS income,
       COUNT(*)::text AS count
     FROM transactions
     WHERE user_id = $1
       AND created_at >= $2 AND created_at < $3`,
    [opts.userId, opts.from.toISOString(), opts.to.toISOString()],
  );
  const r = rows[0];
  return {
    expense: Number(r?.expense ?? 0),
    income: Number(r?.income ?? 0),
    count: Number(r?.count ?? 0),
  };
}

export interface DailyExpense {
  /** YYYY-MM-DD in user's tz */
  day: string;
  total: number; // kopecks
}

export async function getDailyExpenses(opts: PeriodOpts): Promise<DailyExpense[]> {
  const { rows } = await pool.query<{ day: string; total: string }>(
    `SELECT (created_at AT TIME ZONE $2)::date::text AS day,
            SUM(amount)::bigint::text AS total
       FROM transactions
       WHERE user_id = $1
         AND type = 'expense'
         AND created_at >= $3 AND created_at < $4
       GROUP BY 1
       ORDER BY 1 ASC`,
    [opts.userId, opts.tz, opts.from.toISOString(), opts.to.toISOString()],
  );
  return rows.map((r) => ({ day: r.day, total: Number(r.total) }));
}

export async function updateTransactionCategory(
  userId: number,
  id: number,
  category: string,
): Promise<TxRow | null> {
  const { rows } = await pool.query<TxRow>(
    `UPDATE transactions
       SET category = $3
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at`,
    [id, userId, category],
  );
  if (!rows[0]) return null;
  const r = rows[0] as unknown as TxRow & { amount: string };
  return { ...r, amount: Number(r.amount) };
}

export async function countTransactions(userId: number): Promise<number> {
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM transactions WHERE user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.c ?? 0);
}

export async function listTransactions(
  userId: number,
  limit: number,
  offset: number,
): Promise<TxRow[]> {
  const { rows } = await pool.query<TxRow & { amount: string }>(
    `SELECT id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function recentTransactions(userId: number, limit = 10): Promise<TxRow[]> {
  const { rows } = await pool.query<TxRow & { amount: string }>(
    `SELECT id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function transactionsForExport(
  userId: number,
  from: Date,
  to: Date,
): Promise<TxRow[]> {
  const { rows } = await pool.query<TxRow & { amount: string }>(
    `SELECT id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at
       FROM transactions
       WHERE user_id = $1
         AND created_at >= $2 AND created_at < $3
       ORDER BY created_at ASC`,
    [userId, from.toISOString(), to.toISOString()],
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Full-text search across `note`, `raw_text`, and `category` (case-insensitive). */
export async function searchTransactions(
  userId: number,
  query: string,
  limit: number,
): Promise<TxRow[]> {
  const pattern = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const { rows } = await pool.query<TxRow & { amount: string }>(
    `SELECT id, user_id, amount::bigint::text AS amount, type, category, note, raw_text, created_at
       FROM transactions
       WHERE user_id = $1
         AND (note ILIKE $2 ESCAPE '\\'
              OR raw_text ILIKE $2 ESCAPE '\\'
              OR category ILIKE $2 ESCAPE '\\')
       ORDER BY created_at DESC
       LIMIT $3`,
    [userId, pattern, limit],
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Highest single expense in range (used by /stats). */
export async function biggestExpense(
  userId: number,
  from: Date,
  to: Date,
): Promise<{ amount: number; category: string; note: string | null } | null> {
  const { rows } = await pool.query<{ amount: string; category: string; note: string | null }>(
    `SELECT amount::bigint::text AS amount, category, note
       FROM transactions
       WHERE user_id = $1
         AND type = 'expense'
         AND created_at >= $2 AND created_at < $3
       ORDER BY amount DESC
       LIMIT 1`,
    [userId, from.toISOString(), to.toISOString()],
  );
  if (!rows[0]) return null;
  return {
    amount: Number(rows[0].amount),
    category: rows[0].category,
    note: rows[0].note,
  };
}
