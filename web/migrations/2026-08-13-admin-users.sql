CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL CHECK (length(trim(username)) >= 3),
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('super_admin', 'operator')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      INTEGER REFERENCES admin_users (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_key
  ON admin_users (lower(trim(username)));
