ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_suspensions (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users (user_id),
  admin_id        INTEGER NOT NULL REFERENCES admin_users (id),
  reason          TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  duration_label  TEXT NOT NULL CHECK (
    duration_label IN ('1h', '3h', '1d', '3d', '7d', 'permanent')
  ),
  suspended_until TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifted_at       TIMESTAMPTZ,
  lifted_by       INTEGER REFERENCES admin_users (id)
);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user
  ON user_suspensions (user_id, created_at DESC);
