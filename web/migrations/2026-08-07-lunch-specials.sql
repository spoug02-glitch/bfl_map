-- 점심 특선 제보. 카카오가 주는 메뉴 5개에는 점심특선이 거의 안 올라와서
-- (오스시의 1만원 특선이 20,000원 가게로 보였다), 실제로 먹은 사람이
-- 메뉴명·가격을 남긴다. 맛별점과 비고(서술형)는 안 남겨도 된다(NULL).
--
-- PK(place_id, user_id): 한 가게에 한 사람이 제보 하나 — 특선은 바뀌는
-- 거라 다시 제보하면 덮어쓴다. 쌓지 않으니 밀어내기(도배)도 안 된다.
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
