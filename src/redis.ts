import { createClient, type RedisClientType } from 'redis';
import { config } from './config.js';
import { log } from './logger.js';

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (client && client.isOpen) return client;
  client = createClient({ url: config.redisUrl });
  client.on('error', (err) => log.error('redis error', err));
  await client.connect();
  log.info('connected to redis');
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    client = null;
  }
}
