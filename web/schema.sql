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
