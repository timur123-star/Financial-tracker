import { getRedis } from './redis.js';

/**
 * Lightweight per-user "next message is X" intent store, kept in Redis.
 * Used to capture freeform numeric input from inline-button flows
 * (e.g. setting a custom budget or savings goal).
 *
 * Each user can have at most one pending intent at a time.
 */

export type Intent =
  | { kind: 'budget'; category: string }
  | { kind: 'goal' }
  | { kind: 'subscription'; step: 'amount' | 'note' | 'cadence'; draft: Partial<SubscriptionDraft> }
  | { kind: 'search' }
  | { kind: 'csv_import_expect' };

export interface SubscriptionDraft {
  amount: number;
  category: string;
  note: string | null;
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly';
  type: 'expense' | 'income';
}

const TTL_SECONDS = 10 * 60;

function key(userId: number): string {
  return `pending:${userId}`;
}

export async function setPending(userId: number, intent: Intent): Promise<void> {
  const r = await getRedis();
  await r.set(key(userId), JSON.stringify(intent), { EX: TTL_SECONDS });
}

export async function peekPending(userId: number): Promise<Intent | null> {
  const r = await getRedis();
  const raw = await r.get(key(userId));
  return raw ? (JSON.parse(raw) as Intent) : null;
}

export async function consumePending(userId: number): Promise<Intent | null> {
  const r = await getRedis();
  const raw = await r.get(key(userId));
  if (!raw) return null;
  await r.del(key(userId));
  return JSON.parse(raw) as Intent;
}

export async function clearPending(userId: number): Promise<void> {
  const r = await getRedis();
  await r.del(key(userId));
}
