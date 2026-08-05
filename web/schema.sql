CREATE TABLE IF NOT EXISTS users (
  user_id    TEXT PRIMARY KEY,   -- 'kakao:123' / 'google:abc' (구글 로그인은 제거됐지만 옛 행이 남아 있다)
  nickname   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 닉네임은 한 사람당 하나다. 남의 리뷰가 보이는 서비스에서 같은 이름을 여럿이
-- 쓸 수 있으면 사칭이 공짜가 된다. lower()로 거는 이유는 한글엔 대소문자가
-- 없지만 'LunchBoss'와 'lunchboss'는 눈으로 구분되지 않기 때문이다.
-- 기존 DB에는 migrations/2026-08-04-nickname-unique.sql 이 같은 인덱스를 만든다.
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_key ON users (lower(nickname));

CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  place_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL CONSTRAINT reviews_user_fk REFERENCES users (user_id),
  taste         SMALLINT NOT NULL CHECK (taste BETWEEN 1 AND 5),
  waiting       SMALLINT NOT NULL CHECK (waiting BETWEEN 1 AND 5),
  body          VARCHAR(100) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- 같은 사람이 같은 가게에 여러 번 쓸 수 있다. 같은 집을 또 가는 건 흔한 일이고
  -- 그때의 감상은 별개의 기록이다. 7일에 한 번이라는 제한은 애플리케이션이 건다
  -- (app/api/reviews/route.ts) — DB 제약으로 표현하기 어렵다.
);
CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews (place_id);
-- 7일 쿨다운 조회: 이 사람이 이 가게에 마지막으로 쓴 시각
CREATE INDEX IF NOT EXISTS idx_reviews_user_place
  ON reviews (user_id, place_id, created_at DESC);

-- DAU/MAU tracking. One row per visitor per day. visitor_id is an opaque
-- random token the client generates and stores locally (no IP, no user
-- agent, no user id, no PII) — the user can clear it at any time.
CREATE TABLE IF NOT EXISTS visits (
  visitor_id TEXT NOT NULL,
  day        DATE NOT NULL,
  PRIMARY KEY (visitor_id, day)
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits (day);
