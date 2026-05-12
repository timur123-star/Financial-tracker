# Security Policy

## Supported Versions

This is a portfolio / hobby project — the `main` branch is the only "supported"
version. Security fixes land directly on `main`.

| Version  | Supported |
| -------- | --------- |
| `main`   | ✅        |
| `< main` | ❌        |

## Reporting a Vulnerability

If you find a security issue (token leak, SQL injection, RCE, supply-chain
problem, anything that could harm a deployed instance), **please do not open a
public GitHub issue**.

Instead, report privately via GitHub's
[security advisories](https://github.com/timur123-star/Personal-Financial-Tracker/security/advisories/new).

I will respond within **72 hours** with an acknowledgement and, where possible,
a fix or mitigation plan.

## Hardening notes

The bot is designed to be deployed on a single small instance. Hardening tips
for self-hosters:

- **Webhook mode is recommended** for production. Set `WEBHOOK_URL`,
  `WEBHOOK_SECRET_TOKEN`, and `PORT` — Telegram will only deliver updates that
  carry the configured secret token, blocking any random POST to your server.
- **Rate-limit and per-user enforcement** are on by default (Redis-backed,
  30 events/min/user). Tune via the `RATE_LIMIT_*` env vars if needed.
- **Secrets** (`TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`, `DATABASE_URL`,
  `WEBHOOK_SECRET_TOKEN`) must come from your platform's secret store; never
  commit them to git.
- **Database**: amounts are stored as `BIGINT` kopecks (no float drift). User
  IDs are scoped by `user_id` on every query; do not relax this in custom
  queries.
- **Metrics endpoint** (`/metrics`) and **health endpoints** (`/healthz`,
  `/readyz`) are unauthenticated. Bind to localhost (`HEALTH_HOST=127.0.0.1`)
  or proxy behind a load balancer if you do not want them publicly exposed.
- **Dependencies**: `npm audit` is run weekly via Dependabot. CodeQL also runs
  weekly on `main`.

## Known limitations

- The NLP parser delegates to Groq. If you treat NLP output as command input
  for elevated actions (you should not), pre-validate categories against
  `CATEGORIES` allowlist.
- Voice-message transcription sends audio bytes to Groq Whisper. Do not enable
  if your deployment is subject to a privacy-sensitive policy.
