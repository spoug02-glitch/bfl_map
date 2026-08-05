-- 가게 저장(즐겨찾기).
--
-- 서버에 두는 이유: 점심은 자리에서 PC로 고르고 나가면서 폰으로 다시 보는 일이
-- 잦다. localStorage에 넣으면 그 둘이 서로 다른 목록을 보게 된다.
--
-- place_id에는 외래 키를 걸지 않는다 — 가게 목록은 DB가 아니라
-- public/restaurants.json에 있다. 수집을 다시 돌려 사라진 가게가 생기면
-- 저장 목록에서 조용히 빠지고, 그건 화면단에서 걸러진다.

CREATE TABLE IF NOT EXISTS saved_places (
  user_id  TEXT NOT NULL REFERENCES users (user_id),
  place_id TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);
