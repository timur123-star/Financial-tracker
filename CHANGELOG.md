# Changelog

All notable changes to this project are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and adheres loosely to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **ESLint v9 (flat config)** + **Prettier** + **husky** + **lint-staged** —
  `npm run lint`, `npm run format`, pre-commit hooks.
- **CodeQL** security scanning workflow (`security-and-quality` queries,
  weekly + on PR).
- **Webhook mode** for production. Set `WEBHOOK_URL` + `WEBHOOK_SECRET_TOKEN` —
  the bot will run via webhook instead of long polling, with secret-token
  validation enforced by Telegram.
- **Prometheus `/metrics` endpoint** exposing per-update counters, transaction
  counters, error counters and duration histograms.
- **Voice message support** — Russian voice notes are transcribed via Groq
  Whisper (`whisper-large-v3`) and parsed by the same NLP pipeline as text.
- **Forecast in `/stats`** — projection of end-of-period expenses at the
  current spending pace, with delta-to-goal hint.
- **CSV import** — upload a CSV with the same shape as `/export` produces and
  the bot will insert each row as a transaction (de-duplicated by ID + content
  hash).
- **`SECURITY.md`** with hardening guidance, vulnerability reporting workflow,
  and known limitations.
- **`CHANGELOG.md`** (this file).
- **Tests** — 12 new vitest tests covering forecast math, CSV import parsing,
  voice file size guard, and rate-limit edge cases (32 total).

### Changed

- `npm run lint` now runs ESLint (previously aliased `tsc --noEmit`).
- `vitest.config.ts` now loads `tests/setup.ts` so unit tests no longer
  require real env vars to import modules.
- `package.json` `version` bumped to `1.1.0`.
- CI workflow gained a lint step (`npm run lint` + `npm run format:check`).
- README documents webhook mode, metrics endpoint, voice and CSV import.

## [1.0.0] — initial release

### Added

- Telegram bot using **Telegraf 4**, **Node 22**, **TypeScript 5 strict**.
- NLP parsing of free-text transactions via **Groq** (Llama 3.3 70B, JSON mode).
- Multi-transaction support in one message (`«такси 200, кофе 150, обед 650»`).
- AI advisor (`/advice`) — weekly trend analysis.
- **PostgreSQL 16** for persistence (amounts in kopecks, no float).
- **Redis 7** for undo tokens, rate limiting, pending input flows.
- **PNG charts** (donut + daily bar) via `chartjs-node-canvas`.
- Inline-keyboard UX — `/menu`, period navigation, budgets, subscriptions,
  goals, history pagination, settings.
- Subscriptions with daily / weekly / monthly / yearly cadence.
- Monthly goals with progress bars and delta vs previous month.
- CSV export (week / month / quarter / year / all-time, BOM for Excel).
- Search across `note + raw_text + category`.
- Per-user rate-limit (Redis INCR, 30/min).
- Cron jobs: 21:00 evening reminder + Sunday 20:00 weekly report +
  every-5-min subscription auto-charge.
- `/healthz` and `/readyz` HTTP endpoints for Railway / k8s.
- Docker image, `docker-compose` for local dev, Railway deploy config.
- 22 unit tests (vitest).
- CI matrix on Node 20 + 22.
