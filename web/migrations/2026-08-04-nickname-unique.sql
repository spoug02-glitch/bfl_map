-- 닉네임을 한 사람당 하나로 고정한다.
-- 남의 리뷰가 보이는 서비스에서 같은 이름을 여럿이 쓸 수 있으면 사칭이 공짜가 된다.
--
-- lower()로 인덱스를 거는 이유: 한글은 대소문자가 없지만 영문 닉네임은
-- 'Lunch'와 'lunch'가 눈으로 구분되지 않아 그대로 사칭 수단이 된다.
--
-- 이 인덱스를 걸기 전에 이미 중복이 있으면 생성이 실패한다. 그럴 땐 먼저
--   SELECT lower(nickname), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;
-- 로 확인하고 한쪽을 바꾼 뒤 다시 실행한다.

CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_lower_key ON users (lower(nickname));
