-- 제보 접수. /contact 가 이메일로 받던 네 종류를 그대로 옮겼다.
--
-- 업주가 올리는 메뉴는 여기 들어오지 않는다. menu_items 가 이미
-- source_type='owner' + status='pending' 으로 그 일을 하도록 만들어져 있어서,
-- 업주 제출은 pending 행 삽입이고 승인은 published 전환이다.
--
-- contact 와 place_id 가 선택인 이유: 답이 필요 없는 제보가 많고, 강제하면 그것
-- 때문에 안 보낸다. 가게와 무관한 제보도 있고, 가게 이름을 본문에 적는 사람도 있다.
--
-- 비로그인으로 받는다. 로그인을 요구하면 가게 주인도 "여기 폐업했어요"를 알려주려던
-- 사람도 그 자리에서 떠난다. 대신 아무것도 자동 반영되지 않아서, 스팸이 들어와도
-- 어드민 받은함만 지저분해지고 데이터는 오염되지 않는다.
CREATE TABLE IF NOT EXISTS reports (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN
                ('place_fix','delist','abuse','feature')),
  place_id    TEXT,
  body        TEXT NOT NULL CHECK (length(trim(body)) > 0),
  contact     TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','handled','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at  TIMESTAMPTZ,
  handled_by  INTEGER REFERENCES admin_users (id)
);

-- 어드민이 보는 건 사실상 열린 건뿐이다. 처리된 건은 쌓이기만 하고 조회되지 않는다.
CREATE INDEX IF NOT EXISTS idx_reports_open
  ON reports (created_at DESC) WHERE status = 'open';
