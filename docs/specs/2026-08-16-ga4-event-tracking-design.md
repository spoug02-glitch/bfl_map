# GA4 이벤트 트래킹

2026-08-16

## 왜

지금 이 서비스가 아는 것은 "몇 명이 왔는가"(자체 DAU/WAU/MAU)뿐이다. **어디서 온 사람이
무엇을 보고 무엇을 했는지는 하나도 모른다.** 알고 싶은 것은 방문자 수가 아니라 이것이다:

> 어디에서 유입된 사용자가 → 어떤 가게를 보고 → 실제로 그 가게에 가려고 하는가?

특히 ChatGPT·구글·네이버·SNS 등 **유입 출처별로 행동이 어떻게 다른지**를 나중에 GA4에서
분석할 수 있어야 한다.

### 이 앱에서 "핵심 행동"이 무엇인가

이 사이트는 포트폴리오가 아니라 **단일 웹앱**이다. 그래서 흔히 쓰는
`project_view` / `app_launch` / `github_click` / `external_demo_click` 같은 이벤트는
여기에 대응물이 없다(GitHub 링크도, 외부 데모도 없다 — 이 사이트 자체가 그 앱이다).

이 앱에서 사용자의 의도를 가장 강하게 드러내는 행동은 **카카오맵으로 나가는 것**이다.
지도에서 가게를 훑다가 "카카오맵에서 보기 ↗"를 누르는 것은 곧 *그 집에 가보겠다*는
뜻이다. 이것이 이 서비스의 진짜 전환이다.

## 결정적 제약: 가게 상세는 page_view로 안 잡힌다

`PlacePanel`은 라우트가 아니라 `MapApp` 안의 `<aside>` 패널이고, 가게 선택은
`setSelected` React state만 바꾼다 — **URL이 바뀌지 않는다**(`MapApp.tsx`의 유일한
`replaceState`는 공유 링크로 들어왔을 때 URL을 정리하는 용도다).

따라서 **GA4 기본 page_view로는 "어떤 가게를 봤는가"를 영원히 알 수 없다.** 이 설계에서
`place_view` 커스텀 이벤트가 없으면 탐색 깊이를 측정할 수단이 아예 존재하지 않는다.
이것이 이 문서 전체의 출발점이다.

## 기존 analytics와의 관계

`lib/analytics.ts`의 자체 추적은 **그대로 둔다.** 이것은 localStorage 랜덤 ID로 하루 한 번
`/api/visit`을 찍어 DAU/WAU/MAU만 세는 장치이고, 이벤트 추적 기능이 전혀 없어 GA4와
겹치지 않는다. 용도가 다르다:

| | 자체 추적 | GA4 |
|---|---|---|
| 목적 | 어드민 대시보드의 규모 지표 | 유입별 행동/전환 분석 |
| 집계 단위 | 기기별 1일 1회 핑 | 세션·이벤트 |

**두 숫자는 절대 일치하지 않는다.** 집계 기준이 다르므로 서로 대조하지 않는다.

## 이벤트 (8개)

GA4가 자동 수집하는 값(source / medium / referrer / page_location / landing page /
engagement time)은 **어느 이벤트에도 복제하지 않는다.**

| 이벤트 | 발생 조건 | parameter | 목적 |
|---|---|---|---|
| `place_view` | `PlacePanel`이 새 가게로 열릴 때(가게 id가 바뀔 때 1회) | `place_id`, `place_category` | 탐색 깊이. 세션당 발생 수 = 몇 곳을 비교했나 |
| `place_map_open` | 카카오맵 링크 클릭 | `place_id`, `place_category` | **핵심 전환** |
| `blog_review_click` | 만든 이 블로그 후기 클릭 | `place_id` | 내가 쓴 콘텐츠가 실제로 읽히는가 |
| `place_share` | 공유 성공 시 | `place_id`, `method`(`kakao`\|`web_share`\|`copy`) | 바이럴 |
| `review_submit` | 리뷰 작성 성공 시 | `place_id`, `place_category` | 가장 무거운 참여(로그인 필요) |
| `place_engage` | 저장·점심특선 제보 성공 시 | `place_id`, `action`(`save`\|`special`) | 참여 깊이 |
| `login_start` | 카카오 로그인 버튼 클릭 | `trigger`(`header`\|`review`) | 퍼널 관문 |
| `roulette_result` | 룰렛 결과 확정 | `pool_size` | 시그니처 기능 사용률 |

모두 성공 시점에 발화한다(실패한 시도는 세지 않는다). 단 `login_start`와
`place_map_open` / `blog_review_click`은 결과를 알 수 없는 이탈이므로 클릭 시점에 발화한다.

### parameter 선택 근거

- **`place_name`을 넣지 않는다.** `place_id`로 `restaurants.json`에서 조회할 수 있어
  정보가 늘지 않는데 고유값만 5,834개 늘린다.
- **`place_category`를 넣는다.** 업종은 고유값이 수십 개뿐이라 카디널리티가 안전하면서,
  *"ChatGPT 유입은 어떤 업종을 보는가"* 같은 집계를 가능하게 한다. 실질적인 분석은
  이쪽이 담당한다.
- **세션 내 조회 순번(view_index)은 넣지 않는다.** GA4가 세션당 이벤트 수를 이미 제공하므로
  "여러 곳을 봤는가"는 `place_view` 발생 수로 답할 수 있다.

## GA4 쪽 설정 (코드 아님)

1. **맞춤 정의 등록** — 커스텀 파라미터는 등록해야만 리포트에 나타나고 **소급 적용되지
   않는다.** 배포 전에 등록한다.
   - 맞춤 측정기준(이벤트 범위): `place_id`, `place_category`, `method`, `action`, `trigger`
   - 맞춤 측정항목(단위: 표준): `pool_size`
2. **향상된 측정** — 스크롤 수집은 끈다(vanity, 이벤트 스트림만 지저분해진다). 이탈 클릭
   자동 수집은 켜 두어도 되지만, 자동 `click` 이벤트에는 *어느 가게인지*가 없으므로
   `place_map_open` / `blog_review_click`을 대체하지 못한다.
3. **AI 유입 채널 그룹** — `session_source`가 `chatgpt.com`, `perplexity.ai`, `claude.ai`
   등이면 "AI Referral"로 묶는 맞춤 채널 그룹을 만든다.

## 추적하지 않는 것과 그 이유

- **필터 조작(거리·가격·업종), 지도 pan/zoom** — 발생량만 압도적으로 많고 의도 신호는
  약해서, 퍼널에서 봐야 할 이벤트를 덮어버린다.
- **스크롤 깊이·체류시간** — vanity metric. GA4가 `engagement_time_msec`를 자동 수집하니
  필요하면 그걸 보되, 성과 지표로 삼지 않는다.
- **로그인 성공** — 카카오 리다이렉트라 성공 시점 추적이 복잡한 데 비해, 관문 통과율은
  `login_start`만으로 충분히 보인다.
- **싫어하는 음식 설정** — 저빈도이고 퍼널과 무관하다.
- **`contact_click`(mailto)** — 문서 페이지에만 있고 `/contact` 도달 자체가 page_view로
  잡히므로 이벤트가 중복된다. 필요해지면 그때 추가한다.

## 개인정보

GA4로 보내는 값은 `place_id`, `place_category`, `method`, `action`, `trigger`,
`pool_size`뿐이다. 전부 공개 정보이거나 열거형 상수다.

**보내지 않는다:** 닉네임, `user_id`(`kakao:123`), 리뷰 본문, 이메일.

`/ladder/[token]`의 토큰은 개인정보가 아니지만(가게 id + seed 인코딩) 토큰마다 고유해
`page_location` 카디널리티를 키운다 — 알려진 한계로 남긴다.

## 기술적 요구사항

- **`/admin/*`에서는 GA4 스크립트를 아예 로드하지 않는다.** 운영자(=사이트 주인)의
  트래픽이 지표를 오염시키는 것을 원천 차단한다. 루트 레이아웃이 공유되므로
  `usePathname()`으로 판별하는 클라이언트 컴포넌트가 필요하다.
- **개발/프리뷰 트래픽 배제** — `NEXT_PUBLIC_GA_ID`가 있을 때만 스크립트를 렌더하고, 이
  환경변수는 Vercel **Production 환경에만** 설정한다. 로컬과 preview 배포는 자동으로 제외된다.
- **⚠️ SPA page_view 확인 필요** — Next.js App Router는 클라이언트 라우팅 시 page_view가
  자동 발화하지 않을 수 있다. `/`↔문서 페이지 이동(`SiteFooter`의 `<Link>`)이 실제로
  page_view를 남기는지 **실측 확인 후** 수동 발화 필요 여부를 결정한다.
- **중복 발화 방지** — `place_view`의 `useEffect`는 가게 id에만 의존시킨다(패널 리렌더마다
  발화하면 안 된다). `ShareButton`은 `navigator.share` → Kakao → 클립보드로 분기하므로
  **성공한 경로 하나에서만** 발화해야 한다.
- **GA_ID 미설정 시 no-op** — 추적 래퍼는 조용히 아무것도 하지 않는다. 테스트와 로컬 개발이
  영향받지 않는다.

## 최종적으로 볼 수 있는 것

**탐색 경로 (Path exploration)**
`session_source`로 세그먼트 → `page_view(/)` → `place_view` → `place_view` → `place_map_open`

**전환 퍼널 (Funnel exploration)**
1. 세션 시작 → 2. `place_view` ≥1 → 3. `place_view` ≥2(여러 곳 비교) → 4. `place_map_open`

이 퍼널을 `session_source`별로 쪼개면 *"어느 유입이 실제 관심으로 이어지는가"*가 나온다.

## 알려진 한계

- **ChatGPT 유입 구분은 코드로 완전히 풀 수 없다.** AI 챗봇 유입은 referrer가 없거나
  direct로 뭉개지는 경우가 흔해 실제보다 과소 집계된다. "AI 유입 N명"을 정확한 수치로
  믿으면 안 된다.
- **`place_id`는 고유값 5,834개로 GA4의 고카디널리티 경고 대상이다.** 현재 트래픽
  (DAU 10, MAU 84)에서는 실질적 문제가 없지만, 트래픽이 커지면 리포트에서 `(other)`로
  뭉개질 수 있다. 그때는 `place_category` 중심 분석으로 옮긴다.
- **`place_view`는 "봤다"를 과대평가한다.** 지도 마커를 잘못 눌러도 발생한다. 체류 조건
  (예: 2초)을 걸 수도 있으나 복잡도 대비 이득이 불확실해 두지 않는다.
- **`place_engage` 통합의 대가** — 저장과 특선 제보를 한 이벤트로 묶어 개수를 줄인 대신,
  GA4 퍼널에서 하나만 보려면 파라미터 필터를 걸어야 한다.

## 테스트

- `lib/gtag.ts`의 순수 로직 단위 테스트: GA_ID 미설정 시 no-op, 파라미터 형태.
- 컴포넌트 계측은 기존 관례(Task 15/16과 동일)에 따라 `tsc` + 전체 스위트 통과로 갈음한다.
