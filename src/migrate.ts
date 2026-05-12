import { runMigrations, closeDb } from './db.js';
import { log } from './logger.js';

async function main(): Promise<void> {
  await runMigrations();
  await closeDb();
  log.info('migrations done');
}

main().catch((err) => {
  log.error('migration failed', err);
  process.exit(1);
});
