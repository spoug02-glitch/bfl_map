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
--
-- 주의: 여기서 옮기는 reviews.nickname은 이 기능이 등장하기 전, provider가 넘겨준
-- 실명이 그대로 박혀 있던 값이다. 이 문장은 실명이 노출되지 않도록 막으려는
-- 기능의 목적과 정면으로 배치된다. 운영 DB에서는 이미 실행되어 0행 no-op이었지만,
-- reviews.nickname에 provider 실명이 남아 있는 staging/backup DB에다 이 파일을
-- 그대로 돌리면 그 실명들이 조용히 표시 닉네임으로 승격된다.
-- 그런 DB라면 이 INSERT를 승격 용도로 쓰지 말고, 해당 행들의 nickname을
-- 먼저 초기화한 뒤에 실행해야 한다.
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
