-- 출처가 기록되는 메뉴.
--
-- 지금 메뉴는 web/public/restaurants.json 안의 {name, price} 배열이라 두 가지가
-- 불가능하다. 출처를 적을 자리가 없고, 수집기가 매 실행 파일을 통째로 다시 써서
-- (collector/collect.py) 부분 보존도 안 된다 — --skip-menus로 한 번 돌리는 순간
-- 20,560건이 전부 사라진다.
--
-- price가 NULL 허용인 이유: 카카오는 가격 미공개를 -1로 준다(20,560건 중 5,132건,
-- 빈 문자열도 121건). 그대로 옮기면 읽는 쪽마다 -1을 다시 걸러야 한다. 들어올 때
-- 한 번 NULL로 정규화하고, 그 뒤로는 "가격 없음"이 타입으로 표현된다.
--
-- legacy_import는 카카오 유래 기존 데이터를 위한 자리다. 다른 출처와 섞이면
-- "숨기고 순차 교체"라는 선택지 자체가 구현 불가능해진다.
--
-- status: 제보 한 건이 곧바로 확정 데이터가 되지 않게 한다. 서로 다른 사용자 2명이
-- ±20% 안의 가격을 내면 published로 올린다 — 담합 비용이 계정 2개다. 이 판정은
-- web/lib/menu-source.ts의 pricesAgree가 갖고 있다.
CREATE TABLE IF NOT EXISTS menu_items (
  id           SERIAL PRIMARY KEY,
  place_id     TEXT NOT NULL,
  menu_name    TEXT NOT NULL CHECK (length(trim(menu_name)) > 0),
  price        INTEGER CHECK (price IS NULL OR price > 0),
  source_type  TEXT NOT NULL CHECK (source_type IN
                 ('public_data','owner','user_report','official_source','legacy_import')),
  source_ref   TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','published','rejected'))
);

-- 가게별 조회가 유일한 접근 패턴이다. 가격 필터용 전체 요약도 status로 먼저 좁힌다.
CREATE INDEX IF NOT EXISTS idx_menu_items_place ON menu_items (place_id, status);

-- 가격 필터용 요약 쿼리는 status='published' AND price IS NOT NULL 로 좁힌 뒤
-- (place_id, price) 순으로 훑는다. (place_id, status) 인덱스로는 정렬을 못 받아
-- 매 초기 로드마다 정렬이 다시 일어난다. 조건까지 담은 부분 인덱스를 따로 둔다.
CREATE INDEX IF NOT EXISTS idx_menu_items_published_price
  ON menu_items (place_id, price)
  WHERE status = 'published' AND price IS NOT NULL;
