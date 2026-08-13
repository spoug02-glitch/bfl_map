-- 두 번째 별점 축의 이름을 '점심 웨이팅'에서 '점심 편의성'으로 바꾼다.
--
-- 웨이팅은 방향이 모호했다. ★5가 "많이 기다린다"인지 "웨이팅 면에서 좋다"인지
-- 읽는 사람이 알 수 없었다. 편의성은 ★5가 명확히 좋음이고, 맛 축과 방향이 같다.
--
-- 컬럼명도 같이 바꾼다. waiting이라는 이름에 편의성을 담아두면 나중에 이 코드를
-- 읽는 사람이 반드시 반대로 이해한다.

ALTER TABLE reviews RENAME COLUMN waiting TO convenience;

ALTER TABLE reviews RENAME CONSTRAINT reviews_waiting_check TO reviews_convenience_check;
