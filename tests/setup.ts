/**
 * Vitest global setup — provides fallback env vars so unit tests can import
 * modules that pull in `./config.js` without needing a real Telegram token or
 * Postgres connection. Real integration tests should override these explicitly.
 */
process.env.TELEGRAM_BOT_TOKEN ??= 'test-bot-token';
process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:5432/test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.DISABLE_CRON ??= 'true';
process.env.LOG_LEVEL ??= 'error';
