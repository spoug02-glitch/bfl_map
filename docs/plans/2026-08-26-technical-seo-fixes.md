# 테크니컬 SEO 정정 Implementation Plan

**Goal:** 라이브 진단에서 나온 5건을 고친다 — 전 페이지가 홈을 canonical로 가리키는 문제,
`/favicon.ico` 404, 구조화 데이터 부재, `/place/[id]` 5,826개가 크롤러에게 도달 불가인 문제.

**Architecture:** 페이지별 메타데이터는 `lib/page-meta.ts`의 `pageMetadata()` 하나를 거친다 —
canonical과 `og:url`이 갈라지지 않게 한 곳에서 같이 만든다. 구조화 데이터는 순수 함수
(`lib/structured-data.ts`)가 객체를 만들고 `components/JsonLd.tsx`가 그리기만 한다.

**Spec:** 이 문서에 함께 적는다 (별도 design doc 없음 — 화면이 바뀌지 않는 변경이다).

---

## 진단 결과 (2026-08-26, lunchpick.kr 라이브)

| # | 항목 | 상태 |
|---|---|---|
| 1 | canonical | 🔴 8개 경로 전부 `https://lunchpick.kr` |
| 2 | `/favicon.ico` | 🔴 404 |
| 3 | JSON-LD | 🔴 전 페이지 0개 |
| 4 | `/place/[id]` 도달성 | 🔴 사이트맵에도 없고 `<a href>`도 없음 |
| 5 | 이미지 width/height | 🟡 3개 모두 없음, 전부 카카오 SDK 주입 |
| — | robots.txt / sitemap.xml | ✅ 루트에서 200 |
| — | title / description | ✅ 페이지마다 다름 |

## Global Constraints

- **화면은 바뀌지 않는다.** 이번 변경은 `<head>`와 사이트맵까지다. 지도 셸에 서버 렌더
  본문을 넣는 일(=지금 5,826개 페이지의 `<body>`가 전부 같은 문제의 진짜 해결)은
  `claude/map-list-routing-design` 이 다루는 설계 사안이라 여기서 손대지 않는다.
- **새 npm 의존성을 추가하지 않는다.** `favicon.ico`도 표준 라이브러리로 만든다.
- **없는 데이터를 지어내지 않는다.** `aggregateRating`·`priceRange`·`openingHours`는
  검증된 값이 없으므로 JSON-LD에 넣지 않는다. `SearchAction`도 넣지 않는다 —
  이 앱의 검색은 URL에 남지 않아 (`?q=` 없음) 구조화 데이터로 주장하면 거짓이 된다.
- 작업 디렉터리는 전부 `Bfl_map/web/`.
- 커밋은 `git -C "C:/Users/notebook/Desktop/Apps/Bfl_map/.claude/worktrees/seo-canonical-jsonld" add/commit`
  형태로, `add`와 `commit`을 별도 Bash 호출로 한다.

## 설계 결정

### canonical을 페이지마다 명시한다

`app/layout.tsx`의 `alternates: { canonical: "/" }`는 지도의 쿼리 파라미터를 겨냥한 규칙인데,
루트 레이아웃에 있으면 모든 하위 페이지가 그대로 물려받는다. 라이브에서 `/about`부터
`/place/524535584`까지 전부 홈을 정본으로 신고하고 있었다 — 검색엔진에 색인에서 빼달라고
요청하는 것과 같다.

전역 선언을 걷어내고 지도 경로(`/`)에만 그 규칙을 남긴다. 나머지는 `pageMetadata()`가
경로를 받아 canonical과 `og:url`을 같이 만든다. **두 값을 한 함수에서 만드는 게 핵심이다** —
Next의 `openGraph`는 부모와 깊게 병합되지 않아, 자식이 `openGraph`를 쓰는 순간 레이아웃의
`url`·`images`가 통째로 사라진다. 실제로 `/place/[id]`가 그래서 `og:url` 없이 나가고 있었다.

### 사이트맵에 가게 페이지를 넣는다 (기존 판단을 뒤집음)

`sitemap.ts`의 주석은 "같은 지도 셸에 OG 태그만 다른 구조라 중복 콘텐츠로 읽힐 소지"와
"메인 화면에서 링크로 이미 도달 가능"을 이유로 제외를 택했다. 뒤의 전제가 사실이 아니다 —
실제 DOM을 열어보면 목록 50개가 전부 `<button onClick>`이고 `href`에 `/place/`가 든 앵커는
0개다. 유일한 링크인 `RouletteResult`는 `/ladder/[token]`에서만 그려지는데 그 경로는
robots.txt가 막고 있다. 즉 사이트맵에서 빼면 도달 경로가 아예 없다.

앞의 우려는 남는다. 그래서 넣기만 하는 게 아니라 **가게별 canonical + 가게별 JSON-LD를
같이 얹은 뒤에** 넣는다. 상호·주소·좌표·전화·업종이 구조화 데이터로 나가면 본문이 앱
셸이어도 검색엔진이 그 페이지를 무엇으로 다룰지 판단할 근거가 생긴다. 이 셋은 세트이며,
Search Console에서 "중복" 판정이 쌓이면 되돌릴 곳은 `sitemap.ts` 한 줄이다.

5,826개는 사이트맵 한 파일 상한(50,000 URL / 50MB) 안이라 분할하지 않는다.

### 색인에 없는 id는 noindex

`/place/<모르는id>`는 지금 200에 홈 제목을 달고 뜬다(soft 404). 화면은 떠야 한다는 기존
판단은 유지하되 `robots: { index: false }`를 붙여 색인 대상에서만 뺀다.

### favicon.ico

`app/icon.png`(32x32)는 있고 Next는 해시 URL로 내보낸다. 관습 경로 `/favicon.ico`를 직접
때리는 크롤러·리더는 404를 받는다. Vista 이후의 ICO는 PNG를 그대로 품을 수 있으므로,
같은 32x32 PNG를 22바이트 헤더로 감싸 `app/favicon.ico`로 둔다. 인코더 의존성이 필요 없다.

### 이미지 width/height는 손대지 않는다

라이브의 `<img>` 3개는 카카오 지도 SDK가 주입한다(타일·카카오 로고·`office-marker.png`).
앱 JSX에는 `<img>`도 `next/image`도 없어 속성을 붙일 자리가 없고, SDK가 인라인 스타일로
px를 박아 공간은 이미 예약된다(CLS 영향 없음). MutationObserver로 속성을 덧칠하는 건
증상만 가리는 짓이라 하지 않는다.

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `web/lib/page-meta.ts` | `pageMetadata()` — canonical과 og:url을 한 곳에서 |
| `web/lib/place-index.ts` | 가게 색인 항목 타입 + `lookupPlace()` (page.tsx에서 옮김) |
| `web/lib/structured-data.ts` | JSON-LD 객체를 만드는 순수 함수들 |
| `web/components/JsonLd.tsx` | `<script type="application/ld+json">` 렌더 |
| `web/app/favicon.ico` | 관습 경로용 32x32 |
| `web/__tests__/page-meta.test.ts` | canonical·og:url 규칙 |
| `web/__tests__/structured-data.test.ts` | JSON-LD 타입 선택·필드 |
| `web/__tests__/sitemap.test.ts` | 정적 7개 + 가게 전부 |
| `web/__tests__/favicon.test.ts` | 파일 존재와 ICO 헤더 |

**수정**

| 파일 | 변경 |
|---|---|
| `web/app/layout.tsx` | 전역 canonical 제거, openGraph에서 url 제거 |
| `web/app/page.tsx` | canonical `/` + WebSite·Organization JSON-LD |
| `web/app/(docs)/*/page.tsx` | 6개 전부 `pageMetadata()` 사용 |
| `web/app/place/[id]/page.tsx` | canonical `/place/<id>`, 없는 id는 noindex, JSON-LD |
| `web/app/sitemap.ts` | 가게 URL 추가 |
| `web/scripts/build-share-index.mjs` | address·lat·lng·phone 추가 |
| `web/lib/share-index.json` | 재생성 (595KB → 약 1MB) |
| `web/scripts/build-icons.mjs` | favicon.ico 생성 단계 |
| `web/lib/share-copy.ts` | `ShareSubject`는 그대로, 색인 타입만 분리 |

## Tasks

- [x] 1. `lib/page-meta.ts` + 테스트 → 전 페이지 canonical/og:url 정정
- [x] 2. `build-share-index.mjs` 필드 확장 + 색인 재생성 (595KB → 1,242KB)
- [x] 3. `lib/structured-data.ts` + `components/JsonLd.tsx` + 테스트 → 홈·가게 페이지에 부착
- [x] 4. `sitemap.ts`에 가게 URL + 테스트 (7 → 5,833 URL)
- [x] 5. `app/favicon.ico` + `build-icons.mjs` 단계 + 테스트
- [x] 6. `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, 더미 env로 `npm run build`

## 검증 (2026-08-26, 로컬 프로덕션 빌드 :3311)

- tsc 0건, eslint 0 errors(기존 warning 1건은 `goodprice-import.test.ts`), vitest **418 passed** (357 → 418)
- 여덟 경로의 canonical·og:url이 전부 자기 주소로 나가고 서로 겹치지 않음
- `/place/<모르는id>` → `<meta name="robots" content="noindex">`
- `/favicon.ico` → 200 `image/x-icon` 573B, 브라우저에서 32x32로 디코드됨
- `/sitemap.xml` → 5,833 URL (348KB)
- JSON-LD는 페이지당 스크립트 1개, 파싱 통과 (홈 = WebSite+Organization, 가게 = Restaurant+BreadcrumbList)
- 가게 페이지 `<body>` 태그 구조가 배포본과 완전히 동일 (73개, JSON-LD 스크립트 제외) — 화면 변화 없음

## 남은 일 (이번 범위 밖)

1. **지도 셸의 서버 렌더.** 5,826개 페이지의 `<body>`는 여전히 전부 같다. 구조화
   데이터로 구별 근거는 줬지만, 본문이 다른 것이 진짜 답이다. `claude/map-list-routing-design`
   설계와 함께 볼 것.
2. **목록을 `<a>`로.** 지금은 `<button onClick>`이라 사람만 이동할 수 있다. 라우팅
   설계가 정해지면 사이트맵 말고 내부 링크로도 도달하게 된다.
3. **크롤 비용.** `/place/[id]`는 동적 라우트라 크롤 1회 = 함수 호출 1회다.
   5,826개가 사이트맵에 오른 뒤 Vercel 함수 호출 추이를 한 번 볼 것.
4. `app/ladder/[token]/page.tsx`가 서비스 이름과 설명 문자열을 아직 자기 파일에
   복사해 두고 있다 (`SERVICE`로 모으지 않음).
