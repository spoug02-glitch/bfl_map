CREATE TABLE IF NOT EXISTS users (
  user_id    TEXT PRIMARY KEY,   -- 'kakao:123' / 'google:abc' (구글 로그인은 제거됐지만 옛 행이 남아 있다)
  nickname   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_until TIMESTAMPTZ
);
-- 닉네임은 한 사람당 하나다. 남의 리뷰가 보이는 서비스에서 같은 이름을 여럿이
-- 쓸 수 있으면 사칭이 공짜가 된다. lower()로 거는 이유는 한글엔 대소문자가
-- 없지만 'LunchBoss'와 'lunchboss'는 눈으로 구분되지 않기 때문이다.
-- 기존 DB에는 migrations/2026-08-04-nickname-unique.sql 이 같은 인덱스를 만든다.
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_key ON users (lower(nickname));

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

CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  place_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL CONSTRAINT reviews_user_fk REFERENCES users (user_id),
  taste         SMALLINT NOT NULL CHECK (taste BETWEEN 1 AND 5),
  convenience       SMALLINT NOT NULL CHECK (convenience BETWEEN 1 AND 5),
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

-- 가게 저장(즐겨찾기). place_id에 외래 키를 걸지 않는 이유: 가게 목록은 DB가 아니라
-- public/restaurants.json에 있다. 수집을 다시 돌려 사라진 가게는 화면단에서 걸러진다.
CREATE TABLE IF NOT EXISTS saved_places (
  user_id  TEXT NOT NULL REFERENCES users (user_id),
  place_id TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

-- 점심 특선 제보. PK(place_id, user_id) — 한 가게에 한 사람이 하나이고, 특선은 바뀌는
-- 거라 다시 제보하면 덮어쓴다. 쌓지 않으니 도배도 안 된다.
CREATE TABLE IF NOT EXISTS lunch_specials (
  place_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(user_id),
  menu_name  TEXT NOT NULL,
  price      INTEGER NOT NULL,
  taste      SMALLINT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, user_id)
);

-- 탈퇴 후 재가입 차단. 카카오 회원번호를 되돌릴 수 없는 값으로 바꾼 지문만 남긴다 —
-- 이 값으로는 누구인지 알 수 없고, 로그인하는 계정과 대조하는 용도로만 쓴다.
CREATE TABLE IF NOT EXISTS withdrawals (
  fingerprint  TEXT PRIMARY KEY,
  withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 기간이 지난 행은 남겨둘 이유가 없다. 지우는 일은 로그인 경로가 겸한다
-- (그 순간이 이 표를 읽는 유일한 때다).
CREATE INDEX IF NOT EXISTS withdrawals_withdrawn_at_idx ON withdrawals (withdrawn_at);
