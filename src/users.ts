import { pool } from './db.js';
import { config } from './config.js';

export interface UserRow {
  id: number;
  username: string | null;
  first_name: string | null;
  language_code: string | null;
  tz: string;
  currency: string;
  currency_symbol: string;
  notify: boolean;
}

export async function upsertUser(input: {
  id: number;
  username?: string | null;
  first_name?: string | null;
  language_code?: string | null;
}): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (id, username, first_name, language_code, tz, currency, currency_symbol)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       username      = COALESCE(EXCLUDED.username, users.username),
       first_name    = COALESCE(EXCLUDED.first_name, users.first_name),
       language_code = COALESCE(EXCLUDED.language_code, users.language_code),
       updated_at    = now()
     RETURNING id, username, first_name, language_code, tz, currency, currency_symbol, notify`,
    [
      input.id,
      input.username ?? null,
      input.first_name ?? null,
      input.language_code ?? null,
      config.defaultTz,
      config.defaultCurrency,
      config.defaultCurrencySymbol,
    ],
  );
  return rows[0];
}

export async function getUser(id: number): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, username, first_name, language_code, tz, currency, currency_symbol, notify
       FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getOrCreateUser(id: number): Promise<UserRow> {
  const existing = await getUser(id);
  if (existing) return existing;
  return upsertUser({ id });
}

export async function setUserTz(id: number, tz: string): Promise<void> {
  await pool.query('UPDATE users SET tz = $2, updated_at = now() WHERE id = $1', [id, tz]);
}

export async function setUserNotify(id: number, notify: boolean): Promise<void> {
  await pool.query('UPDATE users SET notify = $2, updated_at = now() WHERE id = $1', [id, notify]);
}

export async function setUserCurrency(id: number, code: string, symbol: string): Promise<void> {
  await pool.query(
    'UPDATE users SET currency = $2, currency_symbol = $3, updated_at = now() WHERE id = $1',
    [id, code, symbol],
  );
}

export async function listActiveUsers(): Promise<UserRow[]> {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, username, first_name, language_code, tz, currency, currency_symbol, notify
       FROM users WHERE notify = TRUE`,
  );
  return rows;
}
