# GA4 이벤트 트래킹 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유입 출처별로 "어떤 가게를 보고 실제로 그 집에 가려 했는가"를 GA4에서 분석할 수 있도록, 9개 커스텀 이벤트를 계측한다.

**Architecture:** `lib/gtag.ts`에 타입 안전한 `track()` 래퍼 하나를 두고(GA_ID 없으면 no-op), 클라이언트 컴포넌트 `GoogleAnalytics`가 `/admin/*`이 아닐 때만 스크립트를 로드한다. 각 컴포넌트는 `track()`만 호출한다 — gtag 전역을 직접 만지는 곳은 `lib/gtag.ts` 하나뿐이다.

**Tech Stack:** Next.js 16.2.12 App Router, TypeScript, vitest, `next/script`

**Spec:** `Bfl_map/docs/specs/2026-08-16-ga4-event-tracking-design.md`

## Global Constraints

- **처리방침 개정(Task 1)이 배포보다 먼저다.** 현재 처리방침은 "제3자에게 제공하지 않습니다"라고 명시하고 저장 항목을 "다음이 전부"라고 못박고 있어, GA4를 켜는 순간 문서가 거짓이 된다.
- **동의는 처리방침 고지 모델**을 따른다(기존 국외이전 조항과 동일). 쿠키 동의 배너는 만들지 않는다.
- **`/admin/*`에서는 GA4 스크립트를 로드하지 않는다.** 운영자 트래픽이 지표를 오염시키는 것을 원천 차단한다.
- **`NEXT_PUBLIC_GA_ID`가 없으면 아무것도 하지 않는다.** 로컬·preview·테스트는 자동으로 제외된다.
- **page_view는 자동(향상된 측정)에 맡기고 수동 발화를 넣지 않는다.** 둘 다 하면 두 번 잡힌다.
- **GA4로 보내는 값은 공개 정보와 열거형 상수뿐이다.** 닉네임·`user_id`·리뷰 본문·이메일은 절대 보내지 않는다.
- 이벤트는 **성공 시점**에 발화한다. 단 `login_start`·`place_map_open`·`blog_review_click`은 결과를 알 수 없는 이탈이라 클릭 시점에 발화한다.
- 새 npm 의존성을 추가하지 않는다(`next/script`만 쓴다).
- 작업 디렉터리는 전부 `Bfl_map/web/`.
- 커밋은 반드시 `git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" add/commit` 형태로 한다. 이 저장소의 PreToolUse 훅은 `-C` 없이는 대상 경로를 못 찾아 "staged 변경이 없습니다"로 거부한다. `add`와 `commit`은 **별도 명령**으로 실행한다.

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `web/lib/gtag.ts` | `track()` 래퍼 + 이벤트/파라미터 타입. gtag 전역을 만지는 유일한 곳 |
| `web/__tests__/gtag.test.ts` | 위 모듈 테스트 |
| `web/components/GoogleAnalytics.tsx` | GA4 스크립트 로더. `/admin/*` 제외 |

**수정**

| 파일 | 변경 |
|---|---|
| `web/app/(docs)/privacy/page.tsx` | GA4 관련 4곳 개정 (Task 1) |
| `web/app/layout.tsx` | `<GoogleAnalytics />` 삽입 |
| `web/components/MapApp.tsx` | `entry_context` 상태 + `place_view` 발화, `login_start`(header) |
| `web/components/PlacePanel.tsx` | `place_map_open`, `blog_review_click` |
| `web/components/ShareButton.tsx` | `place_share` (성공한 경로 하나만) |
| `web/components/SaveButton.tsx` | `place_engage`(save) — **해제 시 발화 금지** |
| `web/components/ReviewSection.tsx` | `review_submit`, `login_start`(review) |
| `web/components/SpecialSection.tsx` | `place_engage`(special) |
| `web/components/RoulettePanel.tsx` | `roulette_result`, `roulette_share` |
| `web/.env.example` | `NEXT_PUBLIC_GA_ID` 추가 |

---

### Task 1: 개인정보처리방침 개정

**이 태스크가 먼저다.** 코드가 아니라 문서다. GA4를 붙이기 전에 처리방침이 사실이 되어야 한다.

**Files:**
- Modify: `web/app/(docs)/privacy/page.tsx`

**Interfaces:**
- Produces: 없음 (문서만)

- [ ] **Step 1: 상단 요약 문단 수정**

`web/app/(docs)/privacy/page.tsx`의 기존:

```tsx
      <p className="mt-6 rounded-lg bg-surface-muted p-4 text-sm">
        개인이 만들어 운영하는 서비스입니다. <strong>지금은 광고가 없고</strong>, 수집한 정보를
        판매하거나 제3자에게 제공하지 않습니다.
      </p>
```

을 다음으로 바꾼다:

```tsx
      <p className="mt-6 rounded-lg bg-surface-muted p-4 text-sm">
        개인이 만들어 운영하는 서비스입니다. <strong>지금은 광고가 없고</strong>, 수집한 정보를
        판매하지 않습니다. 다만 어떤 경로로 들어와 무엇을 보는지 파악하기 위해{" "}
        <strong>구글 애널리틱스</strong>를 사용하며, 이때 방문 기록이 구글로 전송됩니다(아래 6항).
      </p>
```

- [ ] **Step 2: 1항 저장 항목에 쿠키 추가**

기존 목록의 마지막 항목:

```tsx
          <li><strong>방문 집계용 임의 토큰</strong> — 브라우저가 만든 무작위 값. 계정과 연결되지 않으며, 브라우저 데이터를 지우면 사라집니다</li>
```

바로 뒤에 한 줄 추가:

```tsx
          <li><strong>구글 애널리틱스 쿠키</strong>(<code>_ga</code>, <code>_ga_*</code>) — 같은 브라우저의 재방문을 알아보기 위한 무작위 값. 계정과 연결되지 않습니다</li>
```

- [ ] **Step 3: 4항 국외 이전에 구글 추가**

기존:

```tsx
          <li><strong>호스팅</strong> — Vercel (미국). 서비스 실행과 접속 로그</li>
```

바로 뒤에 한 줄 추가:

```tsx
          <li><strong>방문 분석</strong> — Google Analytics (구글, 미국). 접속 경로와 화면 이용 기록</li>
```

- [ ] **Step 4: 6항으로 분석 도구 조항 신설**

파일에서 `<DocSection title="5. 얼마나 보관하나요">` 섹션이 끝나는 `</DocSection>` 바로 뒤에 새 섹션을 추가한다. 이후 섹션들의 번호는 **하나씩 밀어서** 다시 매긴다(기존 6항 → 7항, 7항 → 8항 …). 파일을 열어 실제 번호를 확인하고 순서대로 고칠 것.

추가할 섹션:

```tsx
      <DocSection title="6. 방문 분석 도구">
        <p>
          어떤 경로로 들어온 분들이 어떤 가게를 보는지 파악하기 위해 <strong>구글 애널리틱스
          (Google Analytics 4)</strong>를 사용합니다. 서비스 개선을 위한 통계 목적입니다.
        </p>
        <p>구글로 전송되는 것은 다음과 같은 <strong>익명 정보</strong>입니다.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>어디에서 들어왔는지(검색·링크 등 유입 경로)</li>
          <li>어떤 화면을 보고 어떤 가게를 열었는지</li>
          <li>기기·브라우저 종류, 대략적인 접속 지역</li>
        </ul>
        <p>
          <strong>닉네임, 카카오 회원번호, 리뷰 내용은 구글로 보내지 않습니다.</strong> 수집된
          기록은 <strong>14개월</strong> 후 삭제됩니다.
        </p>
        <p className="text-sm text-text-muted">
          브라우저의 쿠키 차단 기능이나 광고 차단 확장 프로그램을 쓰시면 이 수집을 거부할 수
          있으며, 거부하셔도 서비스 이용에는 아무런 제한이 없습니다.
        </p>
      </DocSection>
```

- [ ] **Step 5: 최종 수정일 갱신**

파일 상단의 `const UPDATED = "...";`를 `const UPDATED = "2026-08-16";`으로 바꾼다.

- [ ] **Step 6: 타입 체크 + 전체 테스트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test`
Expected: 타입 에러 없음, 전체 통과. (`__tests__/legal.test.ts`가 문서 관련 상수를 검사하므로 함께 통과해야 한다.)

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" add "Bfl_map/web/app/(docs)/privacy/page.tsx"
```
```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" commit -m "docs(bfl-map): disclose Google Analytics in the privacy policy"
```

---

### Task 2: `lib/gtag.ts` 추적 래퍼

**Files:**
- Create: `web/lib/gtag.ts`
- Test: `web/__tests__/gtag.test.ts`
- Modify: `web/.env.example`

**Interfaces:**
- Produces:
  - `GA_ID: string | undefined` — `process.env.NEXT_PUBLIC_GA_ID`
  - `type EntryContext = "marker" | "list" | "shared_link"`
  - `type TrackEvent` — 9개 이벤트의 이름과 파라미터를 묶은 판별 유니온
  - `track(event: TrackEvent): void` — GA_ID나 `window.gtag`가 없으면 조용히 아무것도 하지 않는다

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/gtag.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** window.gtag 자리에 스파이를 꽂고 모듈을 새로 불러온다. */
async function loadGtag(gaId: string | undefined) {
  vi.resetModules();
  if (gaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
  else process.env.NEXT_PUBLIC_GA_ID = gaId;
  return import("@/lib/gtag");
}

beforeEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_GA_ID;
});

describe("track", () => {
  it("GA_ID가 없으면 gtag를 부르지 않는다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag(undefined);
    track({ name: "place_map_open", place_id: "123", place_category: "한식" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("window.gtag가 없어도 던지지 않는다 (광고 차단·SSR)", async () => {
    vi.stubGlobal("window", {});
    const { track } = await loadGtag("G-TEST123456");
    expect(() =>
      track({ name: "place_map_open", place_id: "123", place_category: "한식" }),
    ).not.toThrow();
  });

  it("이름을 첫 인자로, 나머지 파라미터를 객체로 넘긴다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({ name: "place_view", place_id: "42", place_category: "중식", entry_context: "marker" });
    expect(spy).toHaveBeenCalledWith("event", "place_view", {
      place_id: "42",
      place_category: "중식",
      entry_context: "marker",
    });
  });

  it("name은 페이로드에 포함되지 않는다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({ name: "login_start", trigger: "header" });
    expect(spy).toHaveBeenCalledWith("event", "login_start", { trigger: "header" });
  });

  it("파라미터가 없는 이벤트는 빈 객체를 넘긴다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({ name: "roulette_share", pool_size: 4 });
    expect(spy).toHaveBeenCalledWith("event", "roulette_share", { pool_size: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- gtag.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/gtag"`

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/gtag.ts`:

```ts
/**
 * GA4 이벤트 발화의 단일 창구.
 *
 * gtag 전역을 만지는 곳은 이 파일 하나다. 컴포넌트는 track()만 부른다.
 * GA_ID가 없거나(로컬·preview·테스트) 광고 차단기가 스크립트를 막았으면
 * 조용히 아무것도 하지 않는다 — 분석 실패가 앱을 멈추면 안 된다.
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/** 가게 상세에 어떻게 도달했는지. RoulettePanel에는 onSelect가 없어 룰렛 값은 없다. */
export type EntryContext = "marker" | "list" | "shared_link";

/**
 * 보내는 값은 전부 공개 정보이거나 열거형 상수다.
 * 닉네임·user_id·리뷰 본문·이메일은 어떤 이벤트에도 넣지 않는다.
 */
export type TrackEvent =
  | { name: "place_view"; place_id: string; place_category: string; entry_context: EntryContext }
  | { name: "place_map_open"; place_id: string; place_category: string }
  | { name: "blog_review_click"; place_id: string; place_category: string }
  | { name: "place_share"; place_id: string; method: "kakao" | "web_share" | "copy" }
  | { name: "roulette_share"; pool_size: number }
  | { name: "review_submit"; place_id: string; place_category: string }
  | { name: "place_engage"; place_id: string; action: "save" | "special" }
  | { name: "login_start"; trigger: "header" | "review" }
  | { name: "roulette_result"; pool_size: number; winner_category: string };

type GtagFn = (command: "event", name: string, params: Record<string, unknown>) => void;

export function track(event: TrackEvent): void {
  if (!GA_ID) return;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== "function") return;
  const { name, ...params } = event;
  gtag("event", name, params);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- gtag.test.ts`
Expected: PASS (5개 테스트 통과)

- [ ] **Step 5: `.env.example`에 항목 추가**

`web/.env.example` 끝에 추가:

```
# Google Analytics 4 측정 ID (G-XXXXXXXXXX). Vercel Production 환경에만 설정한다 —
# 비어 있으면 스크립트를 아예 로드하지 않아 로컬·preview 트래픽이 섞이지 않는다.
NEXT_PUBLIC_GA_ID=
```

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" add Bfl_map/web/lib/gtag.ts Bfl_map/web/__tests__/gtag.test.ts Bfl_map/web/.env.example
```
```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" commit -m "feat(bfl-map): add typed GA4 track() wrapper that no-ops without GA_ID"
```

---

### Task 3: GA4 스크립트 로더

**Files:**
- Create: `web/components/GoogleAnalytics.tsx`
- Modify: `web/app/layout.tsx`

**Interfaces:**
- Consumes: `GA_ID` (`@/lib/gtag`)
- Produces: `<GoogleAnalytics />` — 기본 export 클라이언트 컴포넌트

- [ ] **Step 1: 로더 컴포넌트 작성**

Create `web/components/GoogleAnalytics.tsx`:

```tsx
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_ID } from "@/lib/gtag";

/**
 * GA4 스크립트 로더.
 *
 * /admin 아래에서는 아예 로드하지 않는다 — 운영자(=사이트 주인)의 트래픽이
 * 지표를 오염시키면 "어느 유입이 전환되는가"라는 질문 자체가 무의미해진다.
 *
 * page_view는 여기서 수동으로 보내지 않는다. Google 태그의 향상된 측정이
 * 브라우저 기록 변경을 감지해 자동으로 보내므로, 여기서 또 보내면 두 번 잡힌다.
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  if (!GA_ID) return null;
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
```

- [ ] **Step 2: 루트 레이아웃에 삽입**

`web/app/layout.tsx` 상단 import에 추가:

```tsx
import GoogleAnalytics from "@/components/GoogleAnalytics";
```

그리고 `<body>` 안, `{children}` **바로 앞**에 한 줄 넣는다:

```tsx
        <GoogleAnalytics />
```

(파일을 열어 `<body>` 실제 구조를 확인하고 넣을 것. `{children}`을 감싸지 말고 형제로 둔다.)

- [ ] **Step 3: 타입 체크 + 전체 테스트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test`
Expected: 타입 에러 없음, 전체 통과. (`NEXT_PUBLIC_GA_ID`가 없으므로 컴포넌트는 `null`을 반환한다.)

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" add Bfl_map/web/components/GoogleAnalytics.tsx Bfl_map/web/app/layout.tsx
```
```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" commit -m "feat(bfl-map): load GA4 outside /admin, gated on NEXT_PUBLIC_GA_ID"
```

---

### Task 4: 탐색 이벤트 — `place_view`, `place_map_open`, `blog_review_click`

이 태스크가 스펙의 핵심이다. `PlacePanel`은 라우트가 아니라 `<aside>`라서 가게 상세는 page_view로 절대 안 잡힌다 — `place_view`가 없으면 탐색 깊이를 측정할 수단이 아예 없다.

**Files:**
- Modify: `web/components/MapApp.tsx`
- Modify: `web/components/PlacePanel.tsx`

**Interfaces:**
- Consumes: `track`, `EntryContext` (`@/lib/gtag`)
- Produces: `PlacePanel`이 새 prop `entryContext: EntryContext`를 받는다

- [ ] **Step 1: MapApp에 entry_context 상태 추가**

`web/components/MapApp.tsx` 상단 import에 추가:

```tsx
import { track, type EntryContext } from "@/lib/gtag";
```

`const [selected, setSelected] = useState<Restaurant | null>(null);` 바로 뒤에 추가:

```tsx
  // 어떤 경로로 상세를 열었는지. place_view와 함께 보내야 "공유 링크로 온 사람이
  // 다른 가게까지 보는가"를 답할 수 있다.
  const [entryContext, setEntryContext] = useState<EntryContext>("marker");

  /** 상세를 열면서 도달 경로를 함께 기록한다. */
  const selectFrom = useCallback(
    (context: EntryContext) => (place: Restaurant) => {
      setEntryContext(context);
      setSelected(place);
    },
    [],
  );
```

`useCallback`이 아직 import되어 있지 않으면 `react` import에 추가한다.

- [ ] **Step 2: 세 진입점을 각각 구분해서 연결**

(a) 공유 링크 경로 — 기존:

```tsx
      const found = data.find(r => r.kakao_place_id === id);
      if (found) {
        setSelected(found);
```

을:

```tsx
      const found = data.find(r => r.kakao_place_id === id);
      if (found) {
        setEntryContext("shared_link");
        setSelected(found);
```

로 바꾼다.

(b) 지도 마커 — `<MapView ... onSelect={setSelected} />`를 `onSelect={selectFrom("marker")}`로 바꾼다.

(c) 목록 — `<PlaceList ... onSelect={setSelected} />`를 `onSelect={selectFrom("list")}`로 바꾼다.

`setSelected(null)`(닫기·탈퇴 등)은 **그대로 둔다** — 닫는 것은 도달이 아니다.

- [ ] **Step 3: PlacePanel에 entryContext 전달**

`<PlacePanel ... />` 호출에 prop 한 줄 추가:

```tsx
            entryContext={entryContext}
```

- [ ] **Step 4: PlacePanel에서 place_view 발화**

`web/components/PlacePanel.tsx` 상단 import에 추가:

```tsx
import { useEffect } from "react";
import { track, type EntryContext } from "@/lib/gtag";
```

(`react`에서 이미 무언가 import 중이면 `useEffect`만 그 줄에 합친다.)

Props 타입에 추가:

```tsx
  entryContext: EntryContext;
```

컴포넌트 시그니처의 구조분해에 `entryContext`를 추가하고, 함수 본문 맨 위에 다음을 넣는다:

```tsx
  // 의존성은 가게 id 하나뿐이다. restaurant 객체나 entryContext를 넣으면
  // 리렌더마다 다시 발화해 조회 수가 부풀려진다.
  const placeId = r.kakao_place_id;
  const category = r.category;
  useEffect(() => {
    track({
      name: "place_view",
      place_id: placeId,
      place_category: category,
      entry_context: entryContext,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);
```

(컴포넌트가 `restaurant`를 `r`로 받는지 확인하고 실제 변수명에 맞출 것.)

- [ ] **Step 5: 카카오맵 링크에 place_map_open 발화**

기존:

```tsx
        <a className="flex h-11 items-center text-base text-accent underline" href={r.kakao_url} target="_blank" rel="noreferrer">
          카카오맵에서 보기 ↗
        </a>
```

을:

```tsx
        <a
          className="flex h-11 items-center text-base text-accent underline"
          href={r.kakao_url}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            track({ name: "place_map_open", place_id: placeId, place_category: category })
          }
        >
          카카오맵에서 보기 ↗
        </a>
```

로 바꾼다.

- [ ] **Step 6: 블로그 후기 링크에 blog_review_click 발화**

기존 `{blogLink && (<a ... href={blogLink.url} target="_blank" rel="noreferrer">` 의 `<a>` 태그에 `onClick`을 추가한다:

```tsx
          onClick={() =>
            track({ name: "blog_review_click", place_id: placeId, place_category: category })
          }
```

- [ ] **Step 7: 타입 체크 + 전체 테스트 + 린트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test && npm run lint`
Expected: 전부 통과.

- [ ] **Step 8: Commit**

```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" add Bfl_map/web/components/MapApp.tsx Bfl_map/web/components/PlacePanel.tsx
```
```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" commit -m "feat(bfl-map): track place views and outbound clicks with entry context"
```

---

### Task 5: 참여·공유 이벤트

**Files:**
- Modify: `web/components/ShareButton.tsx`
- Modify: `web/components/SaveButton.tsx`
- Modify: `web/components/ReviewSection.tsx`
- Modify: `web/components/SpecialSection.tsx`

**Interfaces:**
- Consumes: `track` (`@/lib/gtag`)

- [ ] **Step 1: ShareButton — 성공한 경로 하나에서만 발화**

`web/components/ShareButton.tsx` 상단에 `import { track } from "@/lib/gtag";`를 추가한다.

이 컴포넌트는 `navigator.share` → Kakao → 클립보드로 분기한다. **각 분기의 성공 지점에서 정확히 한 번만** 발화해야 한다(한 번의 클릭으로 두 번 잡히면 안 된다):

- `navigator.share(...)`가 `await`로 성공한 직후:
  `track({ name: "place_share", place_id: restaurant.kakao_place_id, method: "web_share" });`
- `window.Kakao.Share.sendDefault(...)` 호출 직후:
  `track({ name: "place_share", place_id: restaurant.kakao_place_id, method: "kakao" });`
- `navigator.clipboard.writeText(url)`가 성공한 직후:
  `track({ name: "place_share", place_id: restaurant.kakao_place_id, method: "copy" });`

파일을 열어 각 분기가 실패 시 다음 분기로 **떨어지는지(fallthrough)** 확인할 것. 떨어진다면 발화는 반드시 성공한 쪽에만 있어야 한다. `catch`로 삼켜지는 경로에는 넣지 않는다.

- [ ] **Step 2: SaveButton — 저장할 때만 발화 (해제 시 금지)**

`web/components/SaveButton.tsx` 상단에 `import { track } from "@/lib/gtag";`를 추가한다.

이 컴포넌트는 `const next = !saved;`로 저장/해제를 토글한다. 요청이 성공한 뒤 `onChange(placeId, next);`를 부르는 지점 **바로 앞**에 추가:

```tsx
    // 저장 해제는 관심의 철회다. 같은 이벤트로 세면 신호가 오염된다.
    if (next) track({ name: "place_engage", place_id: placeId, action: "save" });
```

- [ ] **Step 3: ReviewSection — review_submit과 login_start(review)**

`web/components/ReviewSection.tsx` 상단에 `import { track } from "@/lib/gtag";`를 추가한다.

(a) 리뷰 작성 성공 지점 — `submit` 함수에서 `setBody(""); setTaste(0); setConvenience(0);` 바로 앞에 추가:

```tsx
    track({ name: "review_submit", place_id: placeId, place_category: placeCategory });
```

⚠️ `ReviewSection`은 현재 `placeId`만 받고 **업종을 모른다.** `place_category`를 보내려면 `PlacePanel`에서 prop으로 내려줘야 한다:
- `ReviewSection`의 Props에 `placeCategory: string` 추가
- `PlacePanel`의 `<ReviewSection placeId={...} user={user} />` 호출에 `placeCategory={category}` 추가

(b) 로그인 유도 링크 — `href="/api/auth/kakao"`인 `<a>`에 추가:

```tsx
            onClick={() => track({ name: "login_start", trigger: "review" })}
```

- [ ] **Step 4: SpecialSection — place_engage(special)**

`web/components/SpecialSection.tsx` 상단에 `import { track } from "@/lib/gtag";`를 추가한다.

제출 성공 분기(`if (!res || !res.ok) { ... return; }` **뒤**, 즉 성공한 경로)에 추가:

```tsx
    track({ name: "place_engage", place_id: placeId, action: "special" });
```

- [ ] **Step 5: MapApp 헤더 로그인 — login_start(header)**

`web/components/MapApp.tsx`의 `href="/api/auth/kakao"`인 `<a>`에 추가:

```tsx
            onClick={() => track({ name: "login_start", trigger: "header" })}
```

- [ ] **Step 6: 타입 체크 + 전체 테스트 + 린트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test && npm run lint`
Expected: 전부 통과.

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" add Bfl_map/web/components
```
```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" commit -m "feat(bfl-map): track share, save, review and special-report engagement"
```

---

### Task 6: 룰렛 이벤트

**Files:**
- Modify: `web/components/RoulettePanel.tsx`

**Interfaces:**
- Consumes: `track` (`@/lib/gtag`)

- [ ] **Step 1: roulette_result 발화**

`web/components/RoulettePanel.tsx` 상단에 `import { track } from "@/lib/gtag";`를 추가한다.

룰렛 결과가 **확정되는** 지점(당첨 가게가 정해지는 곳)에 추가한다. 파일을 열어 당첨자가 결정되는 위치를 확인하고, 애니메이션이 끝나 결과가 확정될 때 **한 번만** 발화하게 한다:

```tsx
    track({
      name: "roulette_result",
      pool_size: <후보 개수>,
      winner_category: <당첨 가게의 category>,
    });
```

`pool_size`는 룰렛에 담긴 후보 수, `winner_category`는 당첨 가게의 `category` 필드다.

- [ ] **Step 2: roulette_share 발화**

이 컴포넌트에는 자체 공유가 있다 — `navigator.clipboard.writeText(shareUrl())`로 `/ladder/<token>` 링크를 복사한다. 이것은 `place_share`(가게 공유)와 다른 행동이고, **새 유입을 만드는** 행동이라 따로 센다.

`writeText`가 성공한 직후에 추가:

```tsx
    track({ name: "roulette_share", pool_size: <후보 개수> });
```

현재 코드가 `.catch(() => {})`로 실패를 삼키고 있으므로, 발화가 **성공했을 때만** 일어나도록 `await` 이후 위치에 넣을 것.

- [ ] **Step 3: 타입 체크 + 전체 테스트 + 린트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test && npm run lint`
Expected: 전부 통과.

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" add Bfl_map/web/components/RoulettePanel.tsx
```
```bash
git -C "C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin" commit -m "feat(bfl-map): track roulette results and roulette link shares"
```

---

## 배포 전 체크리스트 (코드 아님, 사람이 함)

이 순서를 지켜야 한다 — **2번과 3번은 소급 적용되지 않는다.**

1. **Task 1(처리방침)이 포함된 상태로 배포한다.** GA4를 켜기 전에 문서가 먼저 사실이 되어야 한다.
2. GA4 관리 → **맞춤 정의** 등록: 측정기준 `place_id`, `place_category`, `entry_context`, `method`, `action`, `trigger`, `winner_category` / 측정항목 `pool_size`(단위: 표준)
3. GA4 관리 → **`place_map_open`을 주요 이벤트로 지정**
4. GA4 관리 → 데이터 설정 → **데이터 보존을 14개월로** 변경 (기본값 2개월)
5. GA4 스트림 설정 → **향상된 측정**에서 스크롤 수집 끄기, *"브라우저 기록 이벤트 기반 페이지 변경"*은 **켜 둔다**(page_view를 이쪽에 맡기기로 했으므로)
6. Vercel → `NEXT_PUBLIC_GA_ID`를 **Production 환경에만** 설정 → 재배포
7. 배포 후 GA4 실시간 리포트에서 `place_view` / `place_map_open`이 들어오는지 확인. `/admin`을 돌아다니며 **아무 이벤트도 안 잡히는지**도 함께 확인한다.

---

## Self-Review 메모

- **스펙 커버리지:** 처리방침 개정(Task 1), 래퍼+no-op(Task 2), `/admin` 제외·GA_ID 게이트·page_view 자동 위임(Task 3), `place_view`·`entry_context`·외부 링크 2종(Task 4), 공유·저장·리뷰·특선·로그인(Task 5), 룰렛 2종(Task 6), GA4 설정 6가지(체크리스트) — 스펙의 모든 요구가 태스크에 연결됨.
- **9개 이벤트 전수 확인:** place_view(T4), place_map_open(T4), blog_review_click(T4), place_share(T5), roulette_share(T6), review_submit(T5), place_engage×2(T5), login_start×2(T4는 아님·T5), roulette_result(T6). 누락 없음.
- **타입 일관성:** `TrackEvent` 유니온(Task 2)의 파라미터 이름이 Task 4~6의 호출부와 일치하는지 재확인함. `EntryContext`는 Task 2에서 정의하고 Task 4에서만 쓴다.
- **발견한 숨은 의존성:** `ReviewSection`이 `place_category`를 모른다 — Task 5에 prop 추가 단계를 명시해 두었다. 이걸 빠뜨리면 타입 에러로 즉시 드러난다.
- **의도적으로 코드를 안 읽고 남긴 곳:** Task 6의 룰렛 당첨 확정 지점과 `pool_size` 변수명은 파일을 열어야 정확히 알 수 있어, 위치를 설명하고 구현자가 확인하도록 했다. 나머지 태스크는 전부 실제 코드를 읽고 정확한 기존 코드 조각을 실었다.
