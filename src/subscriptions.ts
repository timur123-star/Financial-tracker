import { pool } from './db.js';

export type SubCadence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface SubRow {
  id: number;
  user_id: number;
  amount: number; // kopecks
  category: string;
  note: string | null;
  type: 'expense' | 'income';
  cadence: SubCadence;
  next_charge: Date;
  active: boolean;
}

interface SubRowDb extends Omit<SubRow, 'amount' | 'next_charge'> {
  amount: string;
  next_charge: string;
}

function hydrate(r: SubRowDb): SubRow {
  return {
    ...r,
    amount: Number(r.amount),
    next_charge: new Date(r.next_charge),
  };
}

/** Add `n` of `unit` to a Date. Used for advancing the `next_charge` cursor. */
export function advance(date: Date, cadence: SubCadence): Date {
  const d = new Date(date);
  switch (cadence) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d;
}

export const CADENCE_LABEL: Record<SubCadence, string> = {
  daily: 'каждый день',
  weekly: 'каждую неделю',
  monthly: 'каждый месяц',
  yearly: 'каждый год',
};

export async function createSubscription(input: {
  userId: number;
  amount: number; // kopecks
  category: string;
  note: string | null;
  type: 'expense' | 'income';
  cadence: SubCadence;
  nextCharge: Date;
}): Promise<SubRow> {
  const { rows } = await pool.query<SubRowDb>(
    `INSERT INTO subscriptions (user_id, amount, category, note, type, cadence, next_charge)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, amount::bigint::text AS amount, category, note, type, cadence,
               next_charge::text AS next_charge, active`,
    [
      input.userId,
      input.amount,
      input.category,
      input.note,
      input.type,
      input.cadence,
      input.nextCharge.toISOString(),
    ],
  );
  return hydrate(rows[0]);
}

export async function listSubscriptions(userId: number): Promise<SubRow[]> {
  const { rows } = await pool.query<SubRowDb>(
    `SELECT id, user_id, amount::bigint::text AS amount, category, note, type, cadence,
            next_charge::text AS next_charge, active
       FROM subscriptions
       WHERE user_id = $1
       ORDER BY active DESC, next_charge ASC`,
    [userId],
  );
  return rows.map(hydrate);
}

export async function getSubscription(userId: number, id: number): Promise<SubRow | null> {
  const { rows } = await pool.query<SubRowDb>(
    `SELECT id, user_id, amount::bigint::text AS amount, category, note, type, cadence,
            next_charge::text AS next_charge, active
       FROM subscriptions
       WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return rows[0] ? hydrate(rows[0]) : null;
}

export async function deleteSubscription(userId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM subscriptions WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return (rowCount ?? 0) > 0;
}

export async function setSubscriptionActive(
  userId: number,
  id: number,
  active: boolean,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE subscriptions
       SET active = $3, updated_at = now()
       WHERE user_id = $1 AND id = $2`,
    [userId, id, active],
  );
  return (rowCount ?? 0) > 0;
}

/** Fetch active subscriptions whose `next_charge` is in the past — call from cron. */
export async function dueSubscriptions(now: Date): Promise<SubRow[]> {
  const { rows } = await pool.query<SubRowDb>(
    `SELECT id, user_id, amount::bigint::text AS amount, category, note, type, cadence,
            next_charge::text AS next_charge, active
       FROM subscriptions
       WHERE active = TRUE AND next_charge <= $1
       ORDER BY next_charge ASC`,
    [now.toISOString()],
  );
  return rows.map(hydrate);
}

export async function bumpNextCharge(id: number, newNext: Date): Promise<void> {
  await pool.query(`UPDATE subscriptions SET next_charge = $2, updated_at = now() WHERE id = $1`, [
    id,
    newNext.toISOString(),
  ]);
}
