-- "점심에 안 열어요" 제보. 점심 지도에 13시 오픈 술집이 후보로 올라오던 문제
-- (2026-08-25 제보)의 유일한 출처다 — 카카오 영업시간은 저작권 판단(37901fe7)으로
-- 쓰지 않고, 착한가격업소·인허가·공식 지역검색 API에는 영업시간 필드가 없다.
CREATE TABLE IF NOT EXISTS lunch_closed_reports (
  place_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 한 사람은 한 가게에 한 표. 이 제보는 가게를 빼는 쪽이라, 한 계정이
  -- 여러 번 눌러 혼자 문턱을 넘길 수 있으면 안 된다.
  PRIMARY KEY (place_id, user_id)
);

-- 필터는 매 방문마다 가게별 제보 수를 통째로 읽는다.
CREATE INDEX IF NOT EXISTS idx_lunch_closed_place ON lunch_closed_reports (place_id);
