import 'dotenv/config';
import crypto from 'node:crypto';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== '' ? v : fallback;
}

function flag(name: string): boolean {
  return (process.env[name] ?? '').toLowerCase() === 'true';
}

const webhookUrlRaw = (process.env.WEBHOOK_URL ?? '').trim();
const hasWebhook = webhookUrlRaw.length > 0;
// If webhook mode is enabled we need a secret token for Telegram's
// `X-Telegram-Bot-Api-Secret-Token` header. Auto-generate one in dev if the
// user did not provide one — production deployers should set it explicitly.
const webhookSecretToken =
  (process.env.WEBHOOK_SECRET_TOKEN ?? '').trim() ||
  (hasWebhook ? crypto.randomBytes(24).toString('hex') : '');

export const config = {
  telegramToken: required('TELEGRAM_BOT_TOKEN'),

  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: optional('GROQ_MODEL', 'llama-3.3-70b-versatile'),
  groqWhisperModel: optional('GROQ_WHISPER_MODEL', 'whisper-large-v3'),
  hasGroq(): boolean {
    return (process.env.GROQ_API_KEY ?? '').trim().length > 0;
  },

  databaseUrl: required('DATABASE_URL'),
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  defaultTz: optional('DEFAULT_TZ', 'Europe/Moscow'),
  defaultCurrency: optional('DEFAULT_CURRENCY', 'RUB'),
  defaultCurrencySymbol: optional('DEFAULT_CURRENCY_SYMBOL', '₽'),

  disableCron: flag('DISABLE_CRON'),
  logLevel: optional('LOG_LEVEL', 'info').toLowerCase(),

  // HTTP server (health + metrics + webhook). Bind to all interfaces by default
  // so platform health probes can reach it; set HEALTH_HOST to 127.0.0.1 to
  // keep it private behind a proxy.
  healthPort: Number(optional('PORT', '8080')),
  healthHost: optional('HEALTH_HOST', '0.0.0.0'),

  // Webhook mode. If WEBHOOK_URL is set, the bot launches via webhook instead
  // of long polling. The same HTTP server handles webhook updates, /healthz,
  // /readyz and /metrics — one process, one port.
  webhookUrl: webhookUrlRaw,
  webhookPath: optional('WEBHOOK_PATH', '/tg/webhook'),
  webhookSecretToken,
  hasWebhook,

  // Metrics endpoint can be disabled in environments where /metrics should
  // not be exposed.
  metricsEnabled: !flag('DISABLE_METRICS'),

  // Voice transcription via Groq Whisper. Disable to ignore voice messages.
  voiceEnabled: !flag('DISABLE_VOICE'),
  voiceMaxSeconds: Number(optional('VOICE_MAX_SECONDS', '300')),
  voiceMaxBytes: Number(optional('VOICE_MAX_BYTES', String(20 * 1024 * 1024))),

  // CSV import limits.
  csvImportMaxBytes: Number(optional('CSV_IMPORT_MAX_BYTES', String(5 * 1024 * 1024))),
  csvImportMaxRows: Number(optional('CSV_IMPORT_MAX_ROWS', '5000')),

  // Rate limit (per-user, Redis-backed).
  rateLimitMax: Number(optional('RATE_LIMIT_MAX', '30')),
  rateLimitWindowSec: Number(optional('RATE_LIMIT_WINDOW_SEC', '60')),
} as const;
