-- 표시 닉네임을 users 한 곳으로 옮긴다.
-- 반드시 새 코드 배포 "전에" 실행한다. 순서가 바뀌면 배포된 코드가
-- 아직 없는 users 테이블을 조인해 500이 난다.

CREATE TABLE IF NOT EXISTS users (
  user_id    TEXT PRIMARY KEY,   -- 'kakao:123' / 'google:abc'
  nickname   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기존 리뷰에 박혀 있던 이름을 잃지 않도록 먼저 옮긴다.
-- 한 사람이 여러 리뷰를 썼다면 가장 최근 것을 채택한다.
INSERT INTO users (user_id, nickname)
  SELECT DISTINCT ON (user_id) user_id, nickname
  FROM reviews
  ORDER BY user_id, updated_at DESC
ON CONFLICT (user_id) DO NOTHING;

-- "users 행 없는 리뷰"라는 상태를 아예 만들 수 없게 한다.
-- 그래야 조회가 INNER JOIN 하나로 끝난다.
ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_fk FOREIGN KEY (user_id) REFERENCES users (user_id);

ALTER TABLE reviews DROP COLUMN nickname;
