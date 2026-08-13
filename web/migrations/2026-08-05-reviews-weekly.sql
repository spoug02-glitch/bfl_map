-- 한 사람이 같은 가게에 리뷰를 여러 번 남길 수 있게 한다.
--
-- 원래는 UNIQUE (place_id, user_id) + upsert 였다. 그래서 다시 쓰면 예전 리뷰가
-- 조용히 덮여 사라졌다. 같은 집을 또 가는 건 직장인의 일상이고, 그때의 감상은
-- 지난번과 다른 별개의 기록이다.
--
-- 대신 같은 가게에는 7일에 한 번만 쓸 수 있게 애플리케이션이 막는다
-- (app/api/reviews/route.ts). DB 제약으로 표현하기 어려운 규칙이라 코드에 둔다.

ALTER TABLE reviews DROP CONSTRAINT reviews_place_id_user_id_key;

-- 위 UNIQUE가 인덱스 역할도 하고 있었다. 7일 쿨다운 조회
-- (이 사람이 이 가게에 마지막으로 쓴 시각)가 매번 테이블을 훑지 않도록 대체한다.
CREATE INDEX IF NOT EXISTS idx_reviews_user_place
  ON reviews (user_id, place_id, created_at DESC);
