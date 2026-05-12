-- Users: store per-user settings (timezone, currency, notifications)
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT PRIMARY KEY,
  username        TEXT,
  first_name      TEXT,
  language_code   TEXT,
  tz              TEXT NOT NULL DEFAULT 'Europe/Moscow',
  currency        TEXT NOT NULL DEFAULT 'RUB',
  currency_symbol TEXT NOT NULL DEFAULT '₽',
  notify          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions: amounts stored as INTEGER kopecks (cents) to avoid float errors
CREATE TABLE IF NOT EXISTS transactions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  amount      BIGINT NOT NULL,        -- in kopecks (1 RUB = 100)
  type        TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  category    TEXT NOT NULL,
  note        TEXT,
  raw_text    TEXT,                   -- original user message
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_created
  ON transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tx_user_category_created
  ON transactions (user_id, category, created_at);

-- Budgets: per-user monthly category limits (also in kopecks)
CREATE TABLE IF NOT EXISTS budgets (
  user_id    BIGINT NOT NULL,
  category   TEXT NOT NULL,
  limit_amt  BIGINT NOT NULL,         -- in kopecks
  month      DATE NOT NULL,           -- first day of month, e.g. 2026-05-01
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category, month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_month
  ON budgets (user_id, month);
