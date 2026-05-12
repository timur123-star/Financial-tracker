-- Recurring subscriptions: auto-charges on a schedule (monthly / weekly / daily / yearly).
CREATE TABLE IF NOT EXISTS subscriptions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT  NOT NULL,
  amount       BIGINT  NOT NULL,                                    -- kopecks
  category     TEXT    NOT NULL,
  note         TEXT,
  type         TEXT    NOT NULL DEFAULT 'expense'
                       CHECK (type IN ('expense', 'income')),
  cadence      TEXT    NOT NULL                                     -- 'daily' | 'weekly' | 'monthly' | 'yearly'
                       CHECK (cadence IN ('daily', 'weekly', 'monthly', 'yearly')),
  next_charge  TIMESTAMPTZ NOT NULL,                                -- next time to auto-insert a transaction
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subs_user
  ON subscriptions (user_id, active);

CREATE INDEX IF NOT EXISTS idx_subs_next
  ON subscriptions (active, next_charge);

-- Savings goal: target spending cap for the current month across ALL categories.
-- Lives next to per-category budgets and gives a single "how much overall" pulse on /stats.
CREATE TABLE IF NOT EXISTS goals (
  user_id      BIGINT  NOT NULL,
  month        DATE    NOT NULL,
  target_amt   BIGINT  NOT NULL,                                    -- kopecks (max monthly expense)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);

-- Index history search by user + raw_text (covers /search command).
CREATE INDEX IF NOT EXISTS idx_tx_user_search
  ON transactions (user_id, created_at DESC);
