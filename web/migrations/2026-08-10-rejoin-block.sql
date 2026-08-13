-- 탈퇴 후 재가입 대기.
-- 반드시 새 코드 배포 "전에" 실행한다. 순서가 바뀌면 탈퇴와 로그인이 없는
-- 테이블을 건드려 500이 난다.
--
-- 카카오 회원번호를 그대로 담지 않는다. 탈퇴하면 지운다고 공지했고, 재가입을
-- 막자고 그 약속을 무를 수는 없다. 여기 남는 fingerprint는 HMAC이라 되돌릴 수
-- 없다 — 이 표만 봐서는 누가 탈퇴했는지 알 수 없고, 로그인하는 순간 그 계정의
-- 번호로 다시 계산해 대조할 때만 일치 여부가 나온다.
--
-- 지문 하나당 한 행이다. 다시 탈퇴하면 시각만 갱신한다.
CREATE TABLE IF NOT EXISTS withdrawals (
  fingerprint  TEXT PRIMARY KEY,
  withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기간이 지난 행은 남겨둘 이유가 없다. 지우는 일은 로그인 경로가 겸한다
-- (그 순간이 이 표를 읽는 유일한 때다).
CREATE INDEX IF NOT EXISTS withdrawals_withdrawn_at_idx ON withdrawals (withdrawn_at);
