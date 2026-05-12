import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { log } from './logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  ssl: config.databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  log.error('postgres pool error', err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function findMigrationsDir(): Promise<string> {
  const candidates = [
    path.resolve(__dirname, '..', 'migrations'),
    path.resolve(__dirname, '..', '..', 'migrations'),
    path.resolve(process.cwd(), 'migrations'),
  ];
  for (const c of candidates) {
    try {
      const st = await fs.stat(c);
      if (st.isDirectory()) return c;
    } catch {
      // ignore
    }
  }
  throw new Error(`Could not find migrations directory. Tried: ${candidates.join(', ')}`);
}

export async function runMigrations(): Promise<void> {
  const dir = await findMigrationsDir();
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    for (const file of files) {
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [
        file,
      ]);
      if (rowCount && rowCount > 0) {
        log.debug('migration already applied:', file);
        continue;
      }
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      log.info('applying migration:', file);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
