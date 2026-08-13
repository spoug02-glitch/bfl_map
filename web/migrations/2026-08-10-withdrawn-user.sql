-- 탈퇴를 "삭제"에서 "익명화"로 바꾸기 위한 대표 계정.
-- 반드시 새 코드 배포 "전에" 실행한다. 순서가 바뀌면 탈퇴 트랜잭션이 없는
-- user_id를 참조해 외래 키에서 터진다.
--
-- user_id에 콜론이 없다: 실제 계정은 언제나 'kakao:123' 꼴이라 이 값과 겹칠 수
-- 없다. 세션에 실리는 것도 provider:id 형태뿐이므로 아무도 이 계정으로 로그인할 수
-- 없다.
--
-- 닉네임에 공백이 있는 것도 의도다. validateNickname의 문자셋은 공백을 막으므로
-- API를 통해서는 이 이름을 만들 수 없다. 다만 공백을 뺀 '익명의저녁러'는 만들 수
-- 있어 사칭이 되므로, 그쪽은 코드에서 따로 예약해 막는다.
INSERT INTO users (user_id, nickname)
VALUES ('withdrawn', '익명의 저녁러')
ON CONFLICT (user_id) DO NOTHING;
