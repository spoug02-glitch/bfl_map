CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  place_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,  -- google account sub
  nickname      TEXT NOT NULL,
  taste         SMALLINT NOT NULL CHECK (taste BETWEEN 1 AND 5),
  waiting       SMALLINT NOT NULL CHECK (waiting BETWEEN 1 AND 5),
  body          VARCHAR(100) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (place_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews (place_id);

-- DAU/MAU tracking. One row per visitor per day. visitor_id is an opaque
-- random token the client generates and stores locally (no IP, no user
-- agent, no user id, no PII) — the user can clear it at any time.
CREATE TABLE IF NOT EXISTS visits (
  visitor_id TEXT NOT NULL,
  day        DATE NOT NULL,
  PRIMARY KEY (visitor_id, day)
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits (day);
