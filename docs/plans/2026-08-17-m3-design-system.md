# Material 3 디자인 시스템 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Bfl_map/web`의 색·타이포·셰이프·엘리베이션 토큰을 Material 3 역할 어휘로 전환하고, 그 어휘로 각 컴포넌트를 다시 그린다.

**Architecture:** `app/globals.css`에 M3 역할 색 토큰(`--md-sys-color-*`)과 타입 스케일·엘리베이션 토큰을 기존 토큰과 공존시켜 추가한 뒤(무변화), 전체 소스에서 구 토큰 클래스명을 M3 역할명으로 기계적으로 치환하는 단일 커밋을 거치고(전체 색 변화, 여기서부터 화면이 바뀐다), 컴포넌트 카테고리별로 셰이프·엘리베이션·상태 레이어를 입힌 뒤, 마지막에 구 토큰 정의를 지운다.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4(`@theme inline`), TypeScript, vitest.

**Spec:** `Bfl_map/docs/specs/2026-08-16-m3-design-system-design.md`

## Global Constraints

- **카카오 노랑 `#fee500`과 그 글자색은 절대 변경 금지** — 브랜드 자산 (스펙 "절대 바뀌지 않는 것")
- **Pretendard 폰트 스택 유지** — Roboto로 바꾸지 않는다 (스펙 "왜 폰트를 안 바꾸는가")
- **44px 터치 타깃 유지** — `h-11`(모바일), `md:h-9`(데스크톱) 그대로
- **`prefers-reduced-motion` 처리 전부 유지** — 사다리·룰렛·토스트 keyframes와 미디어 쿼리는 손대지 않는다
- **`color-scheme: light` 선언 유지** — 그 위 주석도 그대로 (반경 슬라이더 버그 문서)
- **레이아웃 구조 유지** — `h-dvh` 앱 셸, PlacePanel/PlaceList/RoulettePanel의 바텀시트↔사이드패널 반응형 구조, 필터바 접힘 상태 머신은 바꾸지 않는다. RoulettePanel은 스펙의 컴포넌트 매핑 표에 "Full-screen dialog"라 적혀 있지만, 그 표는 시각적 처리 방향이지 레이아웃 재구성 지시가 아니다 — 지금의 바텀시트/사이드패널 레이아웃을 유지하며 다이얼로그에 준하는 elevation·scrim 처리만 입힌다(Task 9에서 결정 근거 재확인).
- **대비 기준**: 본문 텍스트 조합은 4.5:1, 비텍스트(테두리 등)는 3:1 — 스펙의 "대비 검증 결과" 표에 있는 아홉 쌍은 이미 검증됨. 이 표에 없는 새 조합(예: 아이콘 버튼 hover 상태)을 추가할 때는 같은 방식으로 계산해 이 문서에 기록한다.
- **셰이프 스케일은 별도 토큰을 만들지 않는다** — Tailwind 기본 radius 유틸리티(`rounded-md`/`rounded-lg`/`rounded-xl`/`rounded-2xl`/`rounded-full`)가 M3 코너 크기 구간과 이미 충분히 가깝다. 스펙의 "셰이프 스케일" 축은 새 CSS 변수 없이 기존 유틸리티를 M3 가이드에 맞게 일관되게 골라 쓰는 것으로 만족한다 (계획 단계에서 내린 결정 — YAGNI).
- **상태 레이어는 Tailwind의 색상 투명도 접미사로 구현한다** — `hover:bg-on-surface/8`, `active:bg-on-surface/10`처럼 M3 역할색 위에 `/8`(8%)·`/10`(10%)·`/16`(16%) 투명도를 얹는다. 별도 상태-레이어 토큰층은 만들지 않는다.
- **엘리베이션은 surface tint를 섞지 않는다** — 스펙의 "알려진 이탈과 한계"가 이 결정을 컴포넌트 이주 단계로 미뤄뒀다. 이 계획은 M3 공식 elevation 0~5의 무채색 두-겹 그림자(key+ambient)를 그대로 쓴다. tint를 섞는 건 이 계획의 범위 밖이다.
- **관리자 화면(`components/admin/*`)은 기계적 색 토큰 치환만 받는다** — 스펙의 "컴포넌트 매핑" 표는 공개 화면만 다룬다. 관리자 화면에 셰이프·엘리베이션 재설계를 적용하는 것은 스펙이 승인하지 않은 범위 확장이라 이 계획에 넣지 않는다.
- **ReviewSection/SpecialSection/DislikeSettings도 기계적 색 토큰 치환만 받는다** — 같은 이유로 스펙의 컴포넌트 매핑 표에 없다.

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `app/globals.css` | M3 색 역할 토큰, 타입 스케일, 엘리베이션 토큰 추가 → 구 토큰 삭제 |
| `components/FilterBar.tsx` | 업종 선택을 Filter chip으로 |
| `components/PlaceList.tsx` | List item 정리, 탭 pill을 M3 톤으로 |
| `components/PlacePanel.tsx` | Bottom/side sheet elevation |
| `components/RoulettePanel.tsx` | Bottom/side sheet elevation + scrim 처리 |
| `components/NicknameModal.tsx` | Dialog elevation + scrim |
| `components/Toast.tsx` | Snackbar (inverse-surface 톤) |
| `components/SaveButton.tsx`, `ShareButton.tsx`, `MapApp.tsx` | Filled/tonal/icon button 상태 레이어 |
| 나머지 15개 파일 | Task 4의 기계적 색 토큰 치환만 받는다 |

---

### Task 1: M3 색 역할 토큰 층 추가 (공존, 무변화)

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `--md-sys-color-*` CSS 커스텀 프로퍼티 전체 세트(스펙 "색 토큰" 표와 동일한 값). `@theme inline`에 노출되는 새 Tailwind 유틸리티 이름: `primary`, `on-primary`, `primary-container`, `on-primary-container`, `secondary`, `on-secondary`, `secondary-container`, `on-secondary-container`, `tertiary`, `on-tertiary`, `tertiary-container`, `on-tertiary-container`, `error`, `on-error`, `error-container`, `on-error-container`, `on-surface`, `surface-variant`, `on-surface-variant`, `surface-dim`, `surface-bright`, `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest`, `outline`, `outline-variant`, `inverse-surface`, `inverse-on-surface`, `inverse-primary`, `scrim`, `shadow`. **바로 노출하지 않는 이름: `surface`** — 구 `--color-surface`(#ffffff)와 이름이 겹친다. `surface`는 Task 4에서 값을 M3로 flip할 때 함께 노출한다.
- `--md-color-star`(신규 확장 색, `#c85300`)도 이 Task에서 추가하되 `@theme inline`의 `--color-star`는 아직 손대지 않는다(Task 4에서 flip — 지금 flip하면 `text-star`를 쓰는 9곳의 별 색이 바로 바뀐다).

- [ ] **Step 1: `:root`에 M3 시스템 색 역할 변수 추가**

`app/globals.css`의 기존 `:root` 블록(`--color-brand-kakao-text: #000000;` 다음 줄, 42번째 줄 `}` 직전)에 삽입:

```css
  /* ---- Material 3 색 역할 토큰 ----
     docs/specs/2026-08-16-m3-design-system-design.md의 "색 토큰" 표에서 그대로 옮김.
     Terracotta #A9501C / Riviera Blue #183451 / Sand Linen #D4AF83 앵커에서
     @material/material-color-utilities로 계산. 중립 채도는 M3 기본값(4)이 아니라
     12(중립)/16(중립 변형)로 올려 Sand Linen의 따뜻함(hue 72)을 지켰다 — 스펙의
     "중립 채도를 M3 기본값에서 올린 것" 절 참고. 구 토큰과 공존하는 동안은
     아직 어떤 컴포넌트도 이 변수를 쓰지 않는다(Task 4에서 소비 시작). */
  --md-sys-color-primary: #9b4511;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #ffdbcb;
  --md-sys-color-on-primary-container: #341100;
  --md-sys-color-secondary: #0661a4;
  --md-sys-color-on-secondary: #ffffff;
  --md-sys-color-secondary-container: #d2e4ff;
  --md-sys-color-on-secondary-container: #001d36;
  --md-sys-color-tertiary: #655f31;
  --md-sys-color-on-tertiary: #ffffff;
  --md-sys-color-tertiary-container: #ece4aa;
  --md-sys-color-on-tertiary-container: #1f1c00;
  --md-sys-color-error: #ba1a1a;
  --md-sys-color-on-error: #ffffff;
  --md-sys-color-error-container: #ffdad6;
  --md-sys-color-on-error-container: #410002;

  --md-sys-color-surface: #fff8f4;
  --md-sys-color-on-surface: #25190a;
  --md-sys-color-surface-variant: #fcdebc;
  --md-sys-color-on-surface-variant: #57432b;
  --md-sys-color-surface-dim: #edd6be;
  --md-sys-color-surface-bright: #fff8f4;
  --md-sys-color-surface-container-lowest: #ffffff;
  --md-sys-color-surface-container-low: #fff1e5;
  --md-sys-color-surface-container: #ffebd6;
  --md-sys-color-surface-container-high: #fce4cc;
  --md-sys-color-surface-container-highest: #f6dfc6;

  --md-sys-color-outline: #8b7357;
  --md-sys-color-outline-variant: #dec2a2;
  --md-sys-color-inverse-surface: #3c2e1d;
  --md-sys-color-inverse-on-surface: #ffeede;
  --md-sys-color-inverse-primary: #ffb692;
  --md-sys-color-scrim: #000000;
  --md-sys-color-shadow: #000000;

  /* 확장 컬러. --color-price/--color-brand-kakao*는 스펙에 따라 값이 그대로라
     여기 안 옮긴다. --color-star는 값이 바뀌므로(#fe6b00 → #c85300, 스펙의
     "별점 색을 바꾼 이유" 참고) M3 이름공간에 새로 둔다 — Task 4에서
     @theme inline의 --color-star가 이 값을 가리키도록 바꾼다. */
  --md-color-star: #c85300;
```

- [ ] **Step 2: `@theme inline`에 충돌 없는 M3 역할 이름 노출**

`app/globals.css`의 `@theme inline` 블록 안, `--color-brand-kakao-text: var(--color-brand-kakao-text);` 다음(80번째 줄, `/* Figma type scale...` 주석 앞)에 삽입:

```css
  /* ---- M3 역할 이름 Tailwind 유틸리티 노출 ----
     `surface`는 구 --color-surface(#ffffff)와 이름이 겹쳐 여기 없다 — Task 4에서
     구 토큰을 치환하며 함께 flip한다. 그 외 이름은 구 어휘와 겹치지 않아
     지금 노출해도 기존 화면에 아무 영향이 없다(사용하는 컴포넌트가 아직 없다). */
  --color-primary: var(--md-sys-color-primary);
  --color-on-primary: var(--md-sys-color-on-primary);
  --color-primary-container: var(--md-sys-color-primary-container);
  --color-on-primary-container: var(--md-sys-color-on-primary-container);
  --color-secondary: var(--md-sys-color-secondary);
  --color-on-secondary: var(--md-sys-color-on-secondary);
  --color-secondary-container: var(--md-sys-color-secondary-container);
  --color-on-secondary-container: var(--md-sys-color-on-secondary-container);
  --color-tertiary: var(--md-sys-color-tertiary);
  --color-on-tertiary: var(--md-sys-color-on-tertiary);
  --color-tertiary-container: var(--md-sys-color-tertiary-container);
  --color-on-tertiary-container: var(--md-sys-color-on-tertiary-container);
  --color-error: var(--md-sys-color-error);
  --color-on-error: var(--md-sys-color-on-error);
  --color-error-container: var(--md-sys-color-error-container);
  --color-on-error-container: var(--md-sys-color-on-error-container);

  --color-on-surface: var(--md-sys-color-on-surface);
  --color-surface-variant: var(--md-sys-color-surface-variant);
  --color-on-surface-variant: var(--md-sys-color-on-surface-variant);
  --color-surface-dim: var(--md-sys-color-surface-dim);
  --color-surface-bright: var(--md-sys-color-surface-bright);
  --color-surface-container-lowest: var(--md-sys-color-surface-container-lowest);
  --color-surface-container-low: var(--md-sys-color-surface-container-low);
  --color-surface-container: var(--md-sys-color-surface-container);
  --color-surface-container-high: var(--md-sys-color-surface-container-high);
  --color-surface-container-highest: var(--md-sys-color-surface-container-highest);

  --color-outline: var(--md-sys-color-outline);
  --color-outline-variant: var(--md-sys-color-outline-variant);
  --color-inverse-surface: var(--md-sys-color-inverse-surface);
  --color-inverse-on-surface: var(--md-sys-color-inverse-on-surface);
  --color-inverse-primary: var(--md-sys-color-inverse-primary);
  --color-scrim: var(--md-sys-color-scrim);
  --color-shadow: var(--md-sys-color-shadow);
```

- [ ] **Step 3: 빌드 확인**

Run: `cd Bfl_map/web && npm run build`
Expected: 빌드 성공. 새 CSS 변수를 아무도 아직 참조하지 않으므로 출력 CSS 용량만 조금 늘고 렌더 결과는 그대로다.

- [ ] **Step 4: 전체 화면 무변화 확인**

Run: `cd Bfl_map/web && npm run dev` 후 브라우저로 `/`, `/place/[아무 id]`, `/admin` 열람.
Expected: Task 1 이전과 픽셀 단위로 동일하게 보인다(육안 확인 — 이 Task는 색 변화가 없어야 한다).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(bfl-map): add M3 sys-color role tokens alongside existing tokens"
```

---

### Task 2: 타입 스케일 + 엘리베이션 토큰 추가 (공존, 무변화)

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: Tailwind 텍스트 유틸리티 15종(`text-display-large` … `text-label-small`) — 모두 신규 이름이라 충돌 없음. Tailwind 그림자 유틸리티 6종(`shadow-elevation-0` … `shadow-elevation-5`).
- Consumes: 없음 (Task 1과 독립).

- [ ] **Step 1: `@theme inline`에 M3 타입 스케일 추가**

`app/globals.css`의 `@theme inline` 블록 끝(`--text-lg--line-height: 1.5;` 다음, 86번째 줄 `}` 직전)에 삽입:

```css

  /* ---- M3 타입 스케일 (15단계) ----
     px→rem은 16px 기준. weight는 여기서 강제하지 않는다 — 이 앱은 이미 굵은
     제목(font-bold)이 브랜드 톤이라 스펙이 폰트만 유지하고 무게 체계는
     자유로 남겨뒀다(스펙 "타입 스케일"). letter-spacing 없는 role은
     0으로 M3 원 스펙과 동일. 본문 크기(body-large/medium/small)는 기존
     text-base/text-sm/text-xs와 이미 값이 같아(위 --text-xs--line-height 등 참고)
     전면 치환하지 않는다 — 헤더·타이틀처럼 두드러지는 자리에만 새 role을 쓴다. */
  --text-display-large: 3.5625rem;
  --text-display-large--line-height: 4rem;
  --text-display-medium: 2.8125rem;
  --text-display-medium--line-height: 3.25rem;
  --text-display-small: 2.25rem;
  --text-display-small--line-height: 2.75rem;

  --text-headline-large: 2rem;
  --text-headline-large--line-height: 2.5rem;
  --text-headline-medium: 1.75rem;
  --text-headline-medium--line-height: 2.25rem;
  --text-headline-small: 1.5rem;
  --text-headline-small--line-height: 2rem;

  --text-title-large: 1.375rem;
  --text-title-large--line-height: 1.75rem;
  --text-title-medium: 1rem;
  --text-title-medium--line-height: 1.5rem;
  --text-title-medium--letter-spacing: 0.009375rem;
  --text-title-small: 0.875rem;
  --text-title-small--line-height: 1.25rem;
  --text-title-small--letter-spacing: 0.00625rem;

  --text-label-large: 0.875rem;
  --text-label-large--line-height: 1.25rem;
  --text-label-large--letter-spacing: 0.00625rem;
  --text-label-medium: 0.75rem;
  --text-label-medium--line-height: 1rem;
  --text-label-medium--letter-spacing: 0.03125rem;
  --text-label-small: 0.6875rem;
  --text-label-small--line-height: 1rem;
  --text-label-small--letter-spacing: 0.03125rem;

  --text-body-large: 1rem;
  --text-body-large--line-height: 1.5rem;
  --text-body-large--letter-spacing: 0.03125rem;
  --text-body-medium: 0.875rem;
  --text-body-medium--line-height: 1.25rem;
  --text-body-medium--letter-spacing: 0.015625rem;
  --text-body-small: 0.75rem;
  --text-body-small--line-height: 1rem;
  --text-body-small--letter-spacing: 0.025rem;

  /* ---- M3 엘리베이션 (0~5) ----
     surface tint는 섞지 않는다 — 스펙 "알려진 이탈과 한계"가 이 결정을 이
     단계로 미뤄뒀다. M3 공식 key+ambient 두-겹 그림자를 무채색 그대로 쓴다. */
  --shadow-elevation-0: none;
  --shadow-elevation-1: 0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 3px 1px rgb(0 0 0 / 0.15);
  --shadow-elevation-2: 0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15);
  --shadow-elevation-3: 0 1px 3px 0 rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15);
  --shadow-elevation-4: 0 2px 3px 0 rgb(0 0 0 / 0.30), 0 6px 10px 4px rgb(0 0 0 / 0.15);
  --shadow-elevation-5: 0 4px 4px 0 rgb(0 0 0 / 0.30), 0 8px 12px 6px rgb(0 0 0 / 0.15);
```

- [ ] **Step 2: 빌드 확인**

Run: `cd Bfl_map/web && npm run build`
Expected: 빌드 성공, 화면 변화 없음(새 유틸리티를 아무도 안 씀).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(bfl-map): add M3 type scale and elevation tokens"
```

---

### Task 3: 다크모드 잔재 버그 제거

**Files:**
- Modify: `app/globals.css:88-93`

**Interfaces:**
- Consumes: 없음.
- Produces: 없음(버그 수정, 새 인터페이스 없음).

**배경**: 스펙 "다크모드를 만들지 않는 이유" 절 — `color-scheme: light` 선언에도 불구하고 create-next-app 잔재 `@media (prefers-color-scheme: dark)` 블록이 `--background`/`--foreground`만 어둡게 바꿔, `/about` `/terms` `/privacy` `/contact` 문서 페이지가 OS 다크모드 데스크톱에서 검은 배경에 흰 칼럼으로 뜬다.

- [ ] **Step 1: 재현 확인 (수정 전)**

`resize_window` 등으로 `colorScheme: "dark"`를 설정하고 `/privacy`를 열어 배경이 검게, 본문 카드가 밝게 어긋나는 것을 스크린샷으로 확인한다. (수동 확인 — 자동 테스트 대상 아님, CSS이므로.)

- [ ] **Step 2: 다크모드 블록 삭제**

`app/globals.css`에서 다음 블록을 통째로 삭제:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

- [ ] **Step 3: 재현 확인 (수정 후)**

같은 다크모드 설정으로 `/privacy`를 다시 열어 배경이 항상 밝은 톤으로 고정됨을 확인한다.

- [ ] **Step 4: 빌드 + 테스트**

Run: `cd Bfl_map/web && npm run build && npx vitest run`
Expected: 둘 다 통과.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "fix(bfl-map): remove dark-mode remnant that broke docs pages under OS dark mode"
```

---

### Task 4: 전체 소스 기계적 색 토큰 치환 (전체 앱 색 변화)

**이 Task는 21개 파일에 걸친 동일한 문자열 치환이다.** 파일마다 판단이 다른 작업이 아니라 전부 같은 변환表이므로, 파일별 서브태스크로 쪼개지 않고 스크립트 한 번으로 전체를 바꾼 뒤 전체를 한 번에 검증한다 — 일부 파일만 바뀐 중간 상태는 존재해선 안 된다(공유 CSS 변수이므로 부분 적용 시 화면이 깨진다).

**Files:**
- Modify: `components/*.tsx`, `components/admin/*.tsx`, `app/**/*.tsx` (old-token 클래스를 쓰는 모든 파일 — 아래 표의 21개)
- Modify: `app/globals.css` (`--color-surface`, `--color-star`의 `@theme inline` 값을 M3로 flip, `surface` 바른 이름 노출 추가)

**Interfaces:**
- Consumes: Task 1의 `--md-sys-color-*`, Task 1의 `--md-color-star`
- Produces: 구 클래스명은 이 Task 이후 소스에 0건. `bg-surface`/`text-surface` 등 "surface" 계열 바른 이름이 M3 값으로 다시 태어남.

**치환표** (Tailwind 유틸리티 클래스 기준, 좌변은 이 Task 이전에만 존재):

| 구 클래스 | 신 클래스 | 비고 |
|---|---|---|
| `bg-surface-page` | `bg-surface` | M3 surface = 앱 바탕(구 surface-page 자리) |
| `bg-surface` | `bg-surface-container-lowest` | 구 흰 카드/헤더 배경 = M3 최상단 컨테이너(둘 다 `#ffffff`, 값 불변) |
| `text-surface` | `text-surface-container-lowest` | (있다면, 위와 동일 논리) |
| `border-surface` | `border-surface-container-lowest` | (있다면) |
| `bg-surface-muted` | `bg-surface-container` | 중간 톤 카드 배경 |
| `border-border-subtle` | `border-outline-variant` | 옅은 구분선 |
| `border-border` | `border-outline` | 일반 테두리 |
| `text-text-primary` | `text-on-surface` | 본문/제목 글자 |
| `text-text-muted` | `text-on-surface-variant` | 보조 글자 |
| `bg-ink` | `bg-primary` | CTA/선택 칩 배경 |
| `border-ink` | `border-primary` | 선택 칩 테두리 |
| `text-accent` | `text-primary` | 링크/강조 텍스트 |
| `outline-accent` (focus:outline-accent) | `outline-primary` | 포커스 링 |
| `accent-text-muted` (네이티브 range 색) | `accent-on-surface-variant` | 슬라이더 thumb |
| `text-border` | `text-outline-variant` | 빈 별 아이콘(ReviewSection/SpecialSection) |
| `text-star` | 클래스명 불변 | 값만 flip(Task 1의 `--md-color-star`) |
| `text-price`, `bg-price`, `border-price` | 클래스명 불변 | 스펙에 따라 값도 불변 |
| `bg-brand-kakao`, `text-brand-kakao-text` | 클래스명 불변 | 브랜드 자산, 절대 불변 |
| `bg-warning`, `border-warning`, `bg-warning-soft`, `text-warning-text` | 클래스명 불변 | M3 팔레트 밖 — EntryNotice 전용 의미, 스펙 범위 밖 |
| `var(--color-surface-muted)` | `var(--md-sys-color-surface-container)` | `RouletteWheel.tsx` SVG `fill` 속성 |
| `var(--color-surface)` | `var(--md-sys-color-surface-container-lowest)` | `RouletteWheel.tsx` SVG `fill` 속성 |
| `var(--color-ink)` | `var(--md-sys-color-primary)` | `RouletteWheel.tsx` SVG `fill` 속성 |

**대상 파일 21개** (구 토큰 클래스 사용 파일 전부, `grep -rlE` 로 확정):
`components/DislikeSettings.tsx` `components/DocSection.tsx` `components/EntryNotice.tsx` `components/FilterBar.tsx` `components/MapApp.tsx` `components/MenuLines.tsx` `components/NicknameModal.tsx` `components/PlaceList.tsx` `components/PlacePanel.tsx` `components/ReviewSection.tsx` `components/RoulettePanel.tsx` `components/RouletteResult.tsx` `components/RouletteWheel.tsx` `components/SaveButton.tsx` `components/ShareButton.tsx` `components/SiteFooter.tsx` `components/SpecialSection.tsx` `components/admin/AdminDashboard.tsx` `components/admin/AdminLoginForm.tsx` `components/admin/OperatorsPage.tsx` `app/(docs)/layout.tsx`

- [ ] **Step 1: `app/globals.css`에서 `surface`·`star` 값 flip**

`@theme inline` 블록에서 기존 매핑을 찾아 값을 바꾼다:

```diff
- --color-surface: var(--color-surface);
+ --color-surface: var(--md-sys-color-surface);
+ --color-surface-container-lowest: var(--md-sys-color-surface-container-lowest);
```

(`surface-container-lowest`는 Task 1에서 이미 추가했다면 중복 추가하지 않는다 — Task 1 Step 2에서 이미 넣었는지 확인 후 없으면 추가.)

```diff
- --color-star: var(--color-star);
+ --color-star: var(--md-color-star);
```

`:root` 블록에서 이제 아무도 참조하지 않게 될 예정인 구 `--color-surface: #ffffff;`, `--color-star: #fe6b00;` 줄은 **이 Task에서는 지우지 않는다** — Task 5에서 전체 구 토큰과 함께 한 번에 지운다(다른 old-token 값들과 삭제 시점을 맞춰 diff를 하나로 모은다).

- [ ] **Step 2: 스크립트로 전체 파일 일괄 치환**

`Bfl_map/web/`에서 실행:

```bash
cd Bfl_map/web
FILES="components/DislikeSettings.tsx components/DocSection.tsx components/EntryNotice.tsx components/FilterBar.tsx components/MapApp.tsx components/MenuLines.tsx components/NicknameModal.tsx components/PlaceList.tsx components/PlacePanel.tsx components/ReviewSection.tsx components/RoulettePanel.tsx components/RouletteResult.tsx components/SaveButton.tsx components/ShareButton.tsx components/SiteFooter.tsx components/SpecialSection.tsx components/admin/AdminDashboard.tsx components/admin/AdminLoginForm.tsx components/admin/OperatorsPage.tsx app/\(docs\)/layout.tsx"

for f in $FILES; do
  sed -i \
    -e 's/bg-surface-page/bg-surface/g' \
    -e 's/bg-surface-muted/bg-surface-container/g' \
    -e 's/\bbg-surface\b/bg-surface-container-lowest/g' \
    -e 's/border-border-subtle/border-outline-variant/g' \
    -e 's/\bborder-border\b/border-outline/g' \
    -e 's/text-text-primary/text-on-surface/g' \
    -e 's/text-text-muted/text-on-surface-variant/g' \
    -e 's/\bbg-ink\b/bg-primary/g' \
    -e 's/\bborder-ink\b/border-primary/g' \
    -e 's/text-accent/text-primary/g' \
    -e 's/outline-accent/outline-primary/g' \
    -e 's/accent-text-muted/accent-on-surface-variant/g' \
    -e 's/text-border\b/text-outline-variant/g' \
    "$f"
done
```

`bg-surface-page`는 `bg-surface-muted`/`bg-surface` 치환보다 먼저 실행해야 한다(순서상 위 스크립트가 이미 그렇게 되어 있다 — `bg-surface-page`를 먼저 치환해 임시로 `bg-surface`가 된 결과가 그다음 줄의 `\bbg-surface\b` 규칙에 다시 걸려 `bg-surface-container-lowest`로 잘못 치환되지 않도록, **`bg-surface-page` 규칙과 `bg-surface-muted` 규칙을 먼저 실행하고 `\bbg-surface\b` 규칙을 마지막에 실행**한다. 위 sed 커맨드 순서가 이미 그 순서다 — `bg-surface-page` → `bg-surface-muted` → `bg-surface`. 실행 후 Step 3에서 결과를 검증한다.)

- [ ] **Step 3: `components/RouletteWheel.tsx`의 인라인 `var()` 3곳 치환**

```diff
- <circle cx={C} cy={C} r={R} fill="var(--color-surface-muted)" />
+ <circle cx={C} cy={C} r={R} fill="var(--md-sys-color-surface-container)" />
```
```diff
- <circle cx={C} cy={C} r={26} fill="var(--color-surface)" />
+ <circle cx={C} cy={C} r={26} fill="var(--md-sys-color-surface-container-lowest)" />
```
```diff
  fill="var(--color-ink)"
+ (→ "var(--md-sys-color-primary)")
```

- [ ] **Step 4: 치환 결과 확인 — 구 클래스 잔존 0건**

Run:
```bash
cd Bfl_map/web
grep -rnE '\b(bg-surface-page|bg-surface-muted|border-border-subtle|border-border\b|text-text-primary|text-text-muted|bg-ink\b|border-ink\b|text-accent|outline-accent|accent-text-muted|text-border\b)' components app --include="*.tsx"
grep -rn 'var(--color-surface\|var(--color-ink)' components --include="*.tsx"
```
Expected: 둘 다 결과 없음(exit 시 아무 줄도 안 나옴).

- [ ] **Step 5: bg-primary와 짝을 이루는 text-white를 text-on-primary로 정리**

`bg-primary`(구 `bg-ink`)와 나란히 쓰인 `text-white`를 `text-on-primary`로 바꾼다(값은 둘 다 `#ffffff`라 동작은 같지만, 역할 이름 일관성을 위해). 대상은 Step 4의 결과에서 `bg-primary`가 있는 줄과 같은 `className` 문자열 안의 `text-white`다. 다음 파일에서 확인:
- `components/FilterBar.tsx` (전체 칩, 업종 칩 선택 상태)
- `components/PlaceList.tsx` (탭 pill, 반경 넓히기 버튼)
- `components/NicknameModal.tsx` (확인 버튼)
- `components/RoulettePanel.tsx` (돌리기, 결과 링크 복사 버튼)
- `components/SaveButton.tsx` (저장됨 상태)
- `components/MapApp.tsx` (카카오 로그인 버튼, 로그인 실패 배너 확인 버튼)

각 파일에서 `bg-primary`가 포함된 `className`(또는 템플릿 리터럴) 안의 `text-white`를 `text-on-primary`로 손으로 바꾼다(정규식 일괄 치환은 위험하다 — `text-white`가 `bg-primary`와 무관한 자리에도 있을 수 있는지 각 줄을 눈으로 확인하며 바꾼다. 이번 코드베이스는 위 6개 파일 각각 확인 결과 `text-white`가 전부 `bg-ink`/`bg-primary`와 짝이었다).

- [ ] **Step 6: 타입 체크 + 린트 + 테스트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 셋 다 통과. (컬러 토큰은 문자열 클래스명이라 tsc가 오타를 못 잡는다 — Step 4 grep이 실질적 검증이다.)

- [ ] **Step 7: 빌드 + 전체 화면 육안 확인**

Run: `cd Bfl_map/web && npm run build`, 이후 `npm run dev`로 다음 화면을 전부 열어 스크린샷 비교:
- `/` (홈 — 헤더, 필터바 접힘/펼침, 지도, 목록)
- 아무 가게 마커 클릭 → PlacePanel
- 룰렛 버튼 → RoulettePanel (후보 담기 → 돌리기 → 결과)
- "나" 탭 → PlaceList의 저장/리뷰 섹션
- 닉네임 모달(신규 로그인 또는 닉네임 변경)
- `/admin` (로그인 화면, 대시보드)
- `/about` `/terms` `/privacy` `/contact`

Expected: 전체적으로 표면이 따뜻한 톤(#fff8f4 계열)으로, 글자·테두리가 새 M3 값으로 바뀌어 보인다. 깨지거나 텍스트가 안 보이는 자리(대비 실패)가 없어야 한다 — 있다면 Global Constraints의 대비 기준을 다시 확인.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(bfl-map): migrate all components from legacy tokens to M3 role tokens"
```

---

### Task 5: 구 토큰 정의 삭제

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 4가 구 클래스 사용을 0건으로 만들었다는 보장.

- [ ] **Step 1: 삭제 전 최종 확인**

Run:
```bash
cd Bfl_map/web
grep -rn 'surface-page\|surface-muted\|surface-map\|border-border\|text-text-primary\|text-text-muted\|\bbg-ink\b\|\bborder-ink\b\|accent-soft\|\baccent\b' components app --include="*.tsx"
```
Expected: 아무 결과도 없어야 한다. 결과가 있으면 이 Task를 진행하지 않고 Task 4로 돌아가 남은 사용처를 마저 치환한다.

- [ ] **Step 2: `:root`에서 구 토큰 삭제**

`app/globals.css`의 `:root` 블록에서 다음 줄을 삭제:

```css
  --color-surface-page: #f8f9fb;
  --color-surface-muted: #f2f4f6;
  --color-surface-map: #e6e8ea;

  --color-border: #c4c6cd;
  --color-border-subtle: #e0e3e5;

  --color-text-primary: #191c1e;
  --color-text-muted: #6b7280;

  --color-accent: #2563eb;
  --color-accent-soft: rgba(37, 99, 235, 0.1);

  /* Primary CTA / selected-chip background — distinct dark navy from
     --color-text-primary, used across chips, buttons, and badges. */
  --color-ink: #041627;
```

`--color-surface: #ffffff;`와 `--color-star: #fe6b00;`도 삭제한다(Task 4에서 `@theme inline`이 이미 M3 값을 가리키도록 바꿔놨으므로 `:root`의 구 값은 죽은 코드).

`--color-warning`/`--color-warning-soft`/`--color-warning-text`/`--color-price`/`--color-star`(값은 이제 없음, `--md-color-star`가 대신함)/`--color-brand-kakao*`는 **삭제하지 않는다** — Global Constraints에 따라 스펙 범위 밖이거나 값이 불변이다. 단, `--color-star: #fe6b00;` 줄 자체는 이제 `@theme inline`이 참조하지 않으므로 지운다.

- [ ] **Step 3: `@theme inline`에서 죽은 매핑 삭제**

다음 줄을 삭제:

```css
  --color-surface-page: var(--color-surface-page);
  --color-surface-muted: var(--color-surface-muted);
  --color-surface-map: var(--color-surface-map);

  --color-border: var(--color-border);
  --color-border-subtle: var(--color-border-subtle);

  --color-text-primary: var(--color-text-primary);
  --color-text-muted: var(--color-text-muted);

  --color-accent: var(--color-accent);
  --color-accent-soft: var(--color-accent-soft);

  --color-ink: var(--color-ink);
```

`--color-surface: var(--md-sys-color-surface);`와 `--color-star: var(--md-color-star);`는 **유지**(Task 4에서 이미 M3 값을 가리키도록 바꿔둔 살아있는 매핑).

- [ ] **Step 4: 타입 체크 + 린트 + 테스트 + 빌드**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: 전부 통과. CSS 변수 삭제라 tsc/lint/vitest는 애초에 이 변경을 못 보므로, 빌드 성공과 Step 5의 육안 확인이 실질적 검증이다.

- [ ] **Step 5: 전체 화면 재확인**

Task 4 Step 7과 같은 화면들을 다시 열어 Task 4 이후와 동일하게 보이는지 확인(이 Task는 죽은 CSS 삭제일 뿐이라 화면은 안 바뀌어야 한다).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "chore(bfl-map): delete unused legacy color tokens"
```

---

### Task 6: 버튼 — 상태 레이어 적용

**Files:**
- Modify: `components/SaveButton.tsx`
- Modify: `components/ShareButton.tsx`
- Modify: `components/MapApp.tsx` (카카오 로그인 버튼, 로그아웃 버튼, 로그인 실패 배너의 확인 버튼)
- Modify: `components/NicknameModal.tsx` (확인/취소/탈퇴 버튼)
- Modify: `components/RoulettePanel.tsx` (담기/돌리기/결과 복사/후보 고치기 버튼)
- Modify: `components/PlaceList.tsx` (반경 넓히기/필터 초기화 버튼)

**Interfaces:**
- Consumes: Task 4의 `bg-primary`/`text-on-primary`/`bg-surface-container`/`text-on-surface` 등.
- Produces: 없음(시각 마감 작업).

M3의 Filled button은 hover에서 8%, pressed에서 10% on-color 오버레이가 얹힌다. Tailwind v4의 색상 슬래시 문법(`bg-on-primary/8`)으로 표현한다. 이 앱은 모바일 우선(터치)이라 `hover:`는 데스크톱에서만 실질적으로 보이고, `active:`가 터치에서 즉시 반응한다.

- [ ] **Step 1: `SaveButton.tsx`에 상태 레이어 추가**

```diff
       <button
-        className={`mt-4 grid h-11 w-full place-items-center rounded border text-base font-medium shadow-xs disabled:opacity-50 ${
-          saved ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-primary"
+        className={`mt-4 grid h-11 w-full place-items-center rounded-lg border text-base font-medium shadow-xs transition-colors disabled:opacity-50 ${
+          saved
+            ? "border-primary bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/80"
+            : "border-outline bg-surface-container-lowest text-on-surface hover:bg-on-surface/8 active:bg-on-surface/10"
         }`}
```

(이 파일은 Task 4에서 이미 `border-ink bg-ink text-white` → `border-primary bg-primary text-on-primary`로, `border-border bg-surface text-text-primary` → `border-outline bg-surface-container-lowest text-on-surface`로 치환돼 있어야 한다. 이 Step은 그 결과 위에 상태 레이어(`hover:`/`active:`)와 `transition-colors`, 그리고 `rounded`→`rounded-lg`만 얹는다.)

- [ ] **Step 2: `ShareButton.tsx`에 상태 레이어 추가**

```diff
         <button
-          className="grid h-11 flex-1 place-items-center rounded bg-brand-kakao text-base font-medium text-brand-kakao-text shadow-xs"
+          className="grid h-11 flex-1 place-items-center rounded-lg bg-brand-kakao text-base font-medium text-brand-kakao-text shadow-xs transition-colors active:brightness-95"
           onClick={share}
         >
```
```diff
         <button
-          className="grid h-11 flex-1 place-items-center rounded border border-border text-base font-medium text-text-primary shadow-xs"
+          className="grid h-11 flex-1 place-items-center rounded-lg border border-outline text-base font-medium text-on-surface shadow-xs transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
           onClick={copyLink}
         >
```

(카카오 버튼은 브랜드 색이라 M3 상태 레이어 대신 `active:brightness-95`로 최소한의 눌림 피드백만 준다 — 브랜드 색 위에 회색 오버레이를 얹으면 카카오 노랑이 탁해져 브랜드 가이드 위반이 된다.)

- [ ] **Step 3: `MapApp.tsx`의 카카오 로그인/로그아웃 버튼**

```diff
           <a
-            className="grid h-11 place-items-center rounded-lg bg-ink px-4 text-sm font-bold text-white shadow-xs md:h-9"
+            className="grid h-11 place-items-center rounded-lg bg-primary px-4 text-sm font-bold text-on-primary shadow-xs transition-colors hover:bg-primary/90 active:bg-primary/80 md:h-9"
             href="/api/auth/kakao"
           >
```
```diff
             <button
-              className="grid h-11 place-items-center rounded-lg border border-border px-3 text-text-primary md:h-9"
+              className="grid h-11 place-items-center rounded-lg border border-outline px-3 text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 md:h-9"
               onClick={logout}
             >
```
(두 번째 로그아웃 버튼 — 닉네임 없는 상태의 것도 같은 패턴으로.)

로그인 실패 배너의 "확인" 버튼:
```diff
             <button
-              className="mt-3 grid h-11 w-full place-items-center rounded-lg bg-ink text-sm font-bold text-white"
+              className="mt-3 grid h-11 w-full place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 active:bg-primary/80"
               onClick={() => setLoginError(null)}
             >
```

- [ ] **Step 4: `NicknameModal.tsx`의 확인/취소/탈퇴 버튼**

확인(제출) 버튼:
```diff
           <button
             type="submit"
-            className="grid h-11 place-items-center rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
+            className="grid h-11 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
             disabled={busy || suspended}
           >
```
취소 버튼(및 "그만둘래요"):
```diff
           <button
             type="button"
-            className="grid h-11 place-items-center rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
+            className="grid h-11 place-items-center rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
             onClick={onClose}
           >
```
탈퇴(위험) 버튼은 M3 error 역할로:
```diff
           <button
             type="button"
-            className="grid h-11 place-items-center rounded-lg bg-red-600 text-sm font-bold text-white disabled:opacity-50"
+            className="grid h-11 place-items-center rounded-lg bg-error text-sm font-bold text-on-error transition-colors hover:bg-error/90 active:bg-error/80 disabled:opacity-50"
             disabled={busy}
             onClick={withdraw}
           >
```

- [ ] **Step 5: `RoulettePanel.tsx`의 버튼 4종**

담기 버튼(2개, outlined):
```diff
             <button
-              className="h-11 flex-1 rounded-xl border border-border bg-surface text-sm font-bold text-text-primary disabled:opacity-50"
+              className="h-11 flex-1 rounded-xl border border-outline bg-surface-container-lowest text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 disabled:opacity-50"
               disabled={full || savedPlaces.length === 0}
               onClick={addSaved}
             >
```
(같은 패턴을 "랜덤 4곳" 버튼에도 적용.)

돌리기(filled, 비활성 상태 있음):
```diff
           <button
-            className="mt-4 grid h-11 w-full place-items-center rounded-lg bg-ink text-base font-bold text-white disabled:opacity-50"
+            className="mt-4 grid h-11 w-full place-items-center rounded-lg bg-primary text-base font-bold text-on-primary transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
             disabled={picked.length < MIN_LEGS}
             onClick={spin}
           >
```
후보 고치기/다시 돌리기(tonal):
```diff
             <button
-              className="h-11 flex-1 rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
+              className="h-11 flex-1 rounded-lg bg-secondary-container text-sm font-bold text-on-secondary-container transition-colors hover:bg-on-secondary-container/8 active:bg-on-secondary-container/10"
               onClick={() => { setDraw(null); setArrived(false); }}
             >
```
(결과 링크 복사 버튼은 filled — 돌리기와 동일 패턴 `bg-primary text-on-primary`.)

- [ ] **Step 6: `PlaceList.tsx`의 반경 넓히기/필터 초기화 버튼**

```diff
                 <button
-                  className="grid h-11 place-items-center rounded-lg bg-ink text-sm font-bold text-white shadow-xs disabled:opacity-50"
+                  className="grid h-11 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary shadow-xs transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
                   onClick={onWiden}
                   disabled={!canWiden}
                 >
```
```diff
                 <button
-                  className="grid h-11 place-items-center rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
+                  className="grid h-11 place-items-center rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
                   onClick={onReset}
                 >
```

- [ ] **Step 7: 빌드 + 육안 확인**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm run build`
브라우저에서 각 버튼을 마우스 hover/클릭해 상태 레이어가 자연스럽게 나타나는지 확인(데스크톱 폭에서).

- [ ] **Step 8: Commit**

```bash
git add components/SaveButton.tsx components/ShareButton.tsx components/MapApp.tsx components/NicknameModal.tsx components/RoulettePanel.tsx components/PlaceList.tsx
git commit -m "feat(bfl-map): add M3 state layers to filled/outlined/tonal buttons"
```

---

### Task 7: FilterBar — Filter chip

**Files:**
- Modify: `components/FilterBar.tsx`

**Interfaces:**
- Consumes: Task 4의 M3 역할 클래스, Task 6에서 정립한 상태 레이어 패턴.

M3 Filter chip은 선택 시 체크마크(✓)가 붙고 배경이 `secondary-container`(또는 이 앱처럼 강조가 필요하면 `primary`)로 바뀐다. 지금 업종 칩은 선택 시 `bg-ink`(→`bg-primary`, Task 4에서 이미 치환됨) 배경 + 흰 글자만 쓴다. 체크마크를 추가한다.

- [ ] **Step 1: 업종 칩(전체 + 업종별)에 체크마크와 상태 레이어 추가**

"전체" 칩:
```diff
           <button
-            className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3.5 font-bold md:h-9 md:min-w-9 ${
-              group === null ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-primary"
+            className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-3.5 font-bold transition-colors md:h-9 md:min-w-9 ${
+              group === null
+                ? "border-primary bg-primary text-on-primary"
+                : "border-outline bg-surface-container-lowest text-on-surface hover:bg-on-surface/8 active:bg-on-surface/10"
             }`}
             onClick={() => onGroup(null)}
           >
+            {group === null && <span aria-hidden>✓</span>}
             전체
           </button>
```

업종별 칩(`Object.keys(CATEGORY_GROUPS).map`)에도 동일 패턴:
```diff
             <button
               key={g}
-              className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3.5 font-bold md:h-9 md:min-w-9 ${
-                group === g ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-primary"
+              className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-3.5 font-bold transition-colors md:h-9 md:min-w-9 ${
+                group === g
+                  ? "border-primary bg-primary text-on-primary"
+                  : "border-outline bg-surface-container-lowest text-on-surface hover:bg-on-surface/8 active:bg-on-surface/10"
               }`}
               onClick={() => onGroup(group === g ? null : g)}
             >
+              {group === g && <span aria-hidden>✓</span>}
               {g}
             </button>
```

- [ ] **Step 2: 가격 상한 select에도 같은 톤 적용**

```diff
           <select
-            className={`h-11 shrink-0 rounded-xl border px-2.5 text-center font-bold md:h-9 ${
-              priceLimit !== null ? "border-price bg-price text-white" : "border-border bg-surface text-text-primary"
+            className={`h-11 shrink-0 rounded-xl border px-2.5 text-center font-bold transition-colors md:h-9 ${
+              priceLimit !== null ? "border-price bg-price text-white" : "border-outline bg-surface-container-lowest text-on-surface"
             }`}
```

(가격 칩은 `border-price`/`bg-price`가 스펙에 따라 값 불변 확장색이라 그대로 둔다 — Global Constraints. `<option>`의 `bg-surface text-text-primary`도 Task 4에서 이미 `bg-surface-container-lowest text-on-surface`로 치환돼 있어야 한다.)

- [ ] **Step 3: 육안 확인**

브라우저에서 업종 칩을 눌러 체크마크가 뜨고, 다시 누르면 사라지는지 확인. 칩 폭이 체크마크 추가로 밀리며 줄바꿈이 어색해지지 않는지 좁은 화면(375px)에서 확인.

- [ ] **Step 4: Commit**

```bash
git add components/FilterBar.tsx
git commit -m "feat(bfl-map): add M3 filter chip checkmark and state layers to FilterBar"
```

---

### Task 8: PlaceList — List item

**Files:**
- Modify: `components/PlaceList.tsx`

**Interfaces:**
- Consumes: Task 4/6/7의 M3 클래스.

M3 List item은 행 전체가 눌림 상태 레이어를 갖는다. 지금 `Row`는 `<button>`이 행 전체를 감싸고 있어 구조는 이미 M3에 맞다 — 상태 레이어와 탭 pill의 톤만 정리한다.

- [ ] **Step 1: `Row` 컴포넌트에 상태 레이어 추가**

```diff
 function Row({
   title, subtitle, lead, onClick,
 }: { title: string; subtitle: string; lead: string; onClick: () => void }) {
   return (
-    <li className="border-b border-border-subtle/60 last:border-b-0">
-      <button className="flex w-full items-center gap-3 py-3 text-left" onClick={onClick}>
-        <span className="w-14 shrink-0 text-sm font-bold text-accent">{lead}</span>
+    <li className="border-b border-outline-variant/60 last:border-b-0">
+      <button
+        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
+        onClick={onClick}
+      >
+        <span className="w-14 shrink-0 text-sm font-bold text-primary">{lead}</span>
         <span className="min-w-0 flex-1">
-          <span className="block truncate text-base font-medium text-text-primary">{title}</span>
-          <span className="block truncate text-xs text-text-muted">{subtitle}</span>
+          <span className="block truncate text-base font-medium text-on-surface">{title}</span>
+          <span className="block truncate text-xs text-on-surface-variant">{subtitle}</span>
         </span>
       </button>
     </li>
   );
 }
```

(이 파일도 Task 4가 이미 `border-border-subtle`→`border-outline-variant`, `text-accent`→`text-primary`, `text-text-primary`→`text-on-surface`, `text-text-muted`→`text-on-surface-variant`로 치환해뒀어야 한다 — 이 Step은 그 위에 `hover:`/`active:`/`transition-colors`만 얹는다.)

- [ ] **Step 2: 탭 pill(주변/룰렛/나)에 상태 레이어 추가**

```diff
         <button
           aria-current={tab === "near"}
-          className={`h-11 flex-1 rounded-lg text-sm font-bold md:h-9 ${
-            tab === "near" ? "bg-ink text-white" : "bg-surface-muted text-text-muted"
+          className={`h-11 flex-1 rounded-lg text-sm font-bold transition-colors md:h-9 ${
+            tab === "near"
+              ? "bg-primary text-on-primary"
+              : "bg-surface-container text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/10"
           }`}
           onClick={() => onTab("near")}
         >
```
(룰렛 버튼과 "나" 탭도 동일 패턴 — 룰렛은 항상 비선택 톤 `bg-surface-container text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/10`.)

- [ ] **Step 3: 육안 확인 + Commit**

```bash
git add components/PlaceList.tsx
git commit -m "feat(bfl-map): add M3 list-item state layers and tab pill tones to PlaceList"
```

---

### Task 9: PlacePanel / RoulettePanel — Sheet elevation

**Files:**
- Modify: `components/PlacePanel.tsx`
- Modify: `components/RoulettePanel.tsx`

**Interfaces:**
- Consumes: Task 2의 `shadow-elevation-*`.

스펙의 컴포넌트 매핑 표는 PlacePanel을 "Bottom sheet(모바일)/Side sheet(데스크톱)"로, RoulettePanel을 "Full-screen dialog"로 적었다. Global Constraints에서 이미 정리했듯 레이아웃 구조(고정 위치, 반응형 전환)는 바꾸지 않는다 — 두 컴포넌트 모두 지금과 같은 `fixed inset-x-0 bottom-0 … md:absolute md:right-0` 구조를 유지한 채, M3 sheet에 맞는 elevation(레벨 3, M3 스펙의 modal bottom sheet 기준)과 배경 톤만 입힌다. RoulettePanel은 "Full-screen dialog"라는 이름값에 맞춰 elevation을 한 단계 더 올린다(레벨 5 — 화면을 사실상 다 덮는 만큼 가장 위에 뜬다는 신호).

- [ ] **Step 1: `PlacePanel.tsx`에 elevation 3 적용**

```diff
     <aside
-      className="fixed inset-x-0 bottom-0 z-10 max-h-[75dvh] w-full overflow-y-auto
-        rounded-t-2xl border-t border-border-subtle bg-surface p-4 shadow-lg
-        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
-        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0"
+      className="fixed inset-x-0 bottom-0 z-10 max-h-[75dvh] w-full overflow-y-auto
+        rounded-t-2xl border-t border-outline-variant bg-surface-container-low p-4 shadow-[var(--shadow-elevation-3)]
+        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
+        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0"
       style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
     >
```

(배경을 `bg-surface`(Task 4 결과, 옛 `bg-surface-page`)가 아니라 한 단계 밝은 `bg-surface-container-low`로 둔 이유: 시트는 바탕 위에 뜬 별도 표면이라 M3에서 컨테이너 톤을 쓴다. 이 파일이 Task 4 이후 `bg-surface`였다면 — 즉 원래 `bg-surface`(옛 흰 카드)였다면 — 이 Step에서 `bg-surface-container-low`로 바꾼다.)

내부 카드(주소/전화 박스)도 같은 논리로 한 단계 톤 조정:
```diff
-      <div className="mt-4 space-y-2 rounded border border-border-subtle bg-surface-muted p-4">
+      <div className="mt-4 space-y-2 rounded-lg border border-outline-variant bg-surface-container p-4">
```

- [ ] **Step 2: `RoulettePanel.tsx`에 elevation 5 + scrim 적용**

```diff
     <aside
-      className="fixed inset-x-0 bottom-0 z-20 max-h-[75dvh] w-full overflow-y-auto
-        rounded-t-2xl border-t border-border-subtle bg-surface p-4 shadow-lg
-        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
-        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0"
+      className="fixed inset-x-0 bottom-0 z-20 max-h-[75dvh] w-full overflow-y-auto
+        rounded-t-2xl border-t border-outline-variant bg-surface-container-low p-4 shadow-[var(--shadow-elevation-5)]
+        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
+        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0"
       style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
     >
```

내부 "담은 후보" 칩과 결과 카드도 컨테이너 톤으로:
```diff
                     key={r.kakao_place_id}
-                    className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2"
+                    className="flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2"
```
```diff
-            <div className="mt-5 rounded-lg bg-surface-muted p-4">
+            <div className="mt-5 rounded-lg bg-surface-container p-4">
```

- [ ] **Step 3: 육안 확인**

모바일 폭(375px)과 데스크톱 폭(1280px) 둘 다에서 PlacePanel/RoulettePanel을 열어 그림자가 자연스럽게 뜨는지, 시트 배경이 바탕(surface)과 구분되는 톤인지 확인.

- [ ] **Step 4: Commit**

```bash
git add components/PlacePanel.tsx components/RoulettePanel.tsx
git commit -m "feat(bfl-map): apply M3 elevation and container tones to sheets"
```

---

### Task 10: NicknameModal — Dialog

**Files:**
- Modify: `components/NicknameModal.tsx`

**Interfaces:**
- Consumes: Task 2의 `shadow-elevation-*`, `--color-scrim`.

M3 Dialog는 elevation 3 컨테이너 + scrim(반투명 어두운 배경)을 쓴다. 지금 `Dialog`는 이미 구조적으로 M3 dialog와 같다(`role="dialog"` `aria-modal` 초점 가둠) — scrim 색과 컨테이너 elevation만 M3 값으로 바꾼다.

- [ ] **Step 1: scrim과 컨테이너 elevation 적용**

```diff
   return (
-    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
+    <div className="absolute inset-0 z-30 flex items-center justify-center bg-scrim/40 px-6">
       <div
         ref={box}
         role="dialog"
         aria-modal="true"
         aria-labelledby={labelledBy}
-        className="w-full max-w-xs rounded-xl border border-border bg-surface p-6 shadow-lg"
+        className="w-full max-w-xs rounded-xl bg-surface-container-high p-6 shadow-[var(--shadow-elevation-3)]"
       >
         {children}
       </div>
     </div>
   );
```

(`border border-border`를 뺀 이유: M3 Dialog는 테두리 없이 elevation과 배경 톤만으로 경계를 표현한다 — `surface-container-high`가 바탕보다 충분히 밝아 테두리 없이도 구분된다.)

- [ ] **Step 2: 탈퇴 경고 텍스트의 `text-red-600`을 M3 error로**

```diff
-        {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
+        {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}
```
(두 곳 — 탈퇴 확인 화면과 일반 저장 화면의 에러 메시지 둘 다.)

정지 안내 배너도 M3 error-container로:
```diff
       {suspended && (
-        <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
+        <p role="alert" className="mt-2 rounded-lg bg-error-container px-3 py-2 text-xs text-on-error-container">
           {suspendedNotice}
```

- [ ] **Step 3: 대비 확인**

`text-error`(#ba1a1a) on `bg-surface-container-high`(#fce4cc): 계산해 4.5:1 이상인지 확인한다. 미달이면 `text-error` 대신 `text-on-error-container`(#410002, 더 진함)로 대체한다.

- [ ] **Step 4: 육안 확인 + Commit**

```bash
git add components/NicknameModal.tsx
git commit -m "feat(bfl-map): apply M3 scrim, elevation, and error tokens to NicknameModal"
```

---

### Task 11: Toast → Snackbar

**Files:**
- Modify: `components/Toast.tsx`

**Interfaces:**
- Consumes: Task 1의 `--color-inverse-surface`/`--color-inverse-on-surface`.

M3 Snackbar는 `inverse-surface`(어두운 반전 표면) 배경에 `inverse-on-surface` 글자를 쓴다. 지금 `bg-black/80 text-white`는 근사치이므로 정확한 M3 역할로 바꾼다.

- [ ] **Step 1: 배경/글자 색을 inverse 역할로 교체**

```diff
     <div
       role="status"
       aria-live="polite"
       className="toast pointer-events-none fixed inset-x-0 top-20 z-30 mx-auto w-fit
-        max-w-[min(90vw,22rem)] rounded-xl bg-black/80 px-4 py-2.5 text-center
-        text-sm font-medium text-white shadow-lg"
+        max-w-[min(90vw,22rem)] rounded-lg bg-inverse-surface px-4 py-2.5 text-center
+        text-sm font-medium text-inverse-on-surface shadow-[var(--shadow-elevation-3)]"
     >
```

(M3 Snackbar의 코너는 `xs`(4px)에 가깝다 — `rounded-xl`(12px, 기존 값)을 `rounded-lg`(8px)로 살짝 줄인다.)

- [ ] **Step 2: 대비 확인**

`inverse-on-surface`(#ffeede) on `inverse-surface`(#3c2e1d) — 스펙에 이 조합 대비값이 없으므로 직접 계산해 4.5:1 이상인지 확인하고, 이 plan의 결과 문서(구현 후 스펙에 추가하거나 커밋 메시지에 기록)에 남긴다.

- [ ] **Step 3: 육안 확인**

RoulettePanel에서 랜덤 담기가 4곳을 못 채우는 상황(예: 반경 안에 밥집이 4곳 미만)을 만들어 Toast가 뜨는지, 새 색으로 잘 읽히는지 확인.

- [ ] **Step 4: Commit**

```bash
git add components/Toast.tsx
git commit -m "feat(bfl-map): restyle Toast as M3 snackbar with inverse-surface tokens"
```

---

### Task 12: 최종 검증

**Files:** 없음 (검증 전용 Task).

- [ ] **Step 1: 전체 검사 스위트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: 전부 통과.

- [ ] **Step 2: 구 토큰 완전 소거 재확인**

Run:
```bash
cd Bfl_map/web
grep -rn 'surface-page\|surface-muted\|\bbg-ink\b\|\bborder-ink\b\|text-text-primary\|text-text-muted\|border-border\b\|border-border-subtle\|\baccent\b\|accent-soft' components app --include="*.tsx" --include="*.css"
```
Expected: 결과 없음.

- [ ] **Step 3: 스펙의 대비 표 재확인**

`docs/specs/2026-08-16-m3-design-system-design.md`의 "대비 검증 결과" 표 아홉 쌍 + 이 계획에서 새로 추가한 조합(Task 10의 `text-error`/`bg-error-container`, Task 11의 `inverse-on-surface`/`inverse-surface`)을 실제 렌더 화면에서 브라우저 개발자 도구의 색상 대비 검사기로 재확인한다.

- [ ] **Step 4: 전체 화면 최종 스크린샷**

Task 4 Step 7의 화면 목록 전부를 다시 열어 최종 상태를 스크린샷으로 남긴다(리뷰용).

- [ ] **Step 5: 배포 전 안내**

이 Task까지 끝나면 로컬 브랜치(`feature/bfl-map-admin`)에 M3 전환이 전부 커밋된 상태다. 프로덕션 반영은 `git subtree push --prefix=Bfl_map bflmap main`으로 별도 저장소에 푸시해야 한다(메모리 [[bfl-map-project]] 참고) — 이 Task 자체는 푸시하지 않는다, 사용자 확인 후 별도로 진행한다.

- [ ] **Step 6: Commit (있다면 잔여 수정분)**

검증 중 발견된 사소한 수정이 있었다면:
```bash
git add -A
git commit -m "fix(bfl-map): address final M3 verification findings"
```
없으면 이 Step은 생략.

---

## Self-Review 체크리스트 (계획 작성자용, 실행 전 완료)

- [x] 스펙의 "색 토큰" 표 전체가 Task 1에 반영됨
- [x] 스펙의 "커스텀 확장 컬러"(star/price/brand-kakao) 처리가 Task 1/4/5에 명시됨
- [x] 스펙의 "다크모드를 만들지 않는 이유"(버그 수정)가 Task 3에 반영됨
- [x] 스펙의 "타입 스케일"이 Task 2에 반영됨(15단계 전부)
- [x] 스펙의 "셰이프"/"엘리베이션"/"스테이트 레이어" 축이 Global Constraints에서 각각 명시적 결정(기존 유틸리티 재사용/토큰화/Tailwind 슬래시 문법)으로 다뤄짐
- [x] 스펙의 "컴포넌트 매핑" 표 10개 항목이 Task 6~11에 전부 대응됨(버튼류 2종→Task6, FilterBar→Task7, 슬라이더는 이미 사용 중인 `accent-*` 유틸리티로 Task4에서 색만 치환·별도 Task 불필요, PlaceList→Task8, PlacePanel→Task9, PlacePanel 내부 Dialog는 NicknameModal의 Dialog 컴포넌트가 유일한 dialog 구현이라 Task10, 룰렛 패널→Task9, Toast→Task11)
- [x] "절대 바뀌지 않는 것" 6개 항목이 Global Constraints에 전부 나열됨
- [x] "이주 순서"(토큰층 → 타입스케일 → 컴포넌트 이주 → 구토큰 삭제)가 Task 1→2→(3)→4→(6~11)→5 순서와 일치 — 단, 구 토큰 삭제(Task 5)를 컴포넌트 색 치환(Task 4) 직후로 당겼다: 스펙은 "구 토큰 + 다크모드 잔재 삭제"를 마지막 한 단계로 뒀지만, 셰이프/엘리베이션 마감(Task 6~11)은 구 토큰을 전혀 참조하지 않는 별도 관심사라 삭제를 미룰 이유가 없다. 먼저 지워 죽은 코드가 이후 작업 내내 눈에 띄지 않게 한다.
- [x] 플레이스홀더("TBD" 등) 없음 — 전수 검색 완료
- [x] 타입/클래스명 일관성 — Task별로 실제 클래스명을 재사용(예: Task6~11이 전부 Task4 산출물인 `bg-primary`/`text-on-surface` 등을 그대로 참조)

---

**Plan complete and saved to `Bfl_map/docs/plans/2026-08-17-m3-design-system.md`.**
