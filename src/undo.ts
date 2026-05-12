import { randomBytes } from 'node:crypto';
import { getRedis } from './redis.js';

const TTL_SECONDS = 5 * 60; // 5 minutes

function key(token: string): string {
  return `undo:${token}`;
}

export async function storeUndo(userId: number, txIds: number[]): Promise<string> {
  const token = randomBytes(8).toString('hex');
  const r = await getRedis();
  await r.set(key(token), JSON.stringify({ userId, txIds }), { EX: TTL_SECONDS });
  return token;
}

export async function consumeUndo(
  token: string,
  expectedUserId: number,
): Promise<{ txIds: number[] } | null> {
  const r = await getRedis();
  const raw = await r.get(key(token));
  if (!raw) return null;
  await r.del(key(token));
  try {
    const parsed = JSON.parse(raw) as { userId: number; txIds: number[] };
    if (parsed.userId !== expectedUserId) return null;
    return { txIds: parsed.txIds };
  } catch {
    return null;
  }
}
