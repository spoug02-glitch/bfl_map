# 메뉴 출처 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가격 필터를 카카오 크롤러에서 떼어내, 크롤러를 언제 끄든 화면이 무너지지 않는 상태를 만든다.

**Architecture:** `menu_items` 테이블을 새로 만들고 출처(`source_type`)와 확인일을 필수로 기록한다. `effectiveMinPrice`가 DB 메뉴를 1차로 보고 `restaurants.json`의 카카오 메뉴를 fallback으로 삼도록 뒤집는다. 제보 UI는 기존 `SpecialSection`을 재사용하고 진입 문구만 상황에 따라 분기한다. 크롤러는 이 계획에서 끄지 않는다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Neon Postgres(`@neondatabase/serverless`), vitest.

**Spec:** `Bfl_map/docs/specs/2026-08-17-menu-provenance-design.md`

## Global Constraints

- **크롤러를 끄지 않는다.** `collector/menu.py`도 `--skip-menus` 기본값도 이 계획에서 건드리지 않는다. 처분 결정은 커버리지를 실측한 뒤 별도로 한다.
- **기존 메뉴 데이터를 지우지 않는다.** `restaurants.json`의 `menus` 필드는 그대로 둔다.
- **메뉴 사진은 수집하지 않는다.** `collector/menu.py:6-9`의 기존 방침을 유지한다.
- **`restaurants.json`의 식당 기본 정보 구조를 바꾸지 않는다.** 배포 파이프라인(`git subtree push`)과 5,834행 데이터에 영향을 주면 안 된다.
- **`source_type` 허용값은 정확히 다섯 개**: `public_data`, `owner`, `user_report`, `official_source`, `legacy_import`. 스펙이 정한 값이며 CHECK 제약으로 강제한다.
- **`status` 허용값은 정확히 세 개**: `pending`, `published`, `rejected`.
- **교차검증 기준은 서로 다른 사용자 2명, 가격 ±20% 이내.** 이 두 숫자는 스펙이 정했다.
- **가격 미상은 `NULL`로 정규화한다.** 카카오의 `-1`과 빈 문자열을 DB로 옮길 때 NULL이 된다. DB에서 나온 값에 `-1` 필터를 다시 적용하지 않는다.
- **어드민 검토 큐를 만들지 않는다.** 스펙의 "하지 않는 것".
- **44px 터치 타깃**(`h-11`, 데스크톱 `md:h-9`), **M3 역할 토큰**만 사용, **`prefers-reduced-motion` 처리 불변** — 기존 코드베이스 관례.
- 검증 명령은 이 워크트리에 `.env.local`이 없어 더미 env가 필요하다:
  `DATABASE_URL="postgres://u:p@localhost:5432/db" ADMIN_SESSION_SECRET="x" SESSION_SECRET="x" npm run build`
  그리고 **dev 서버를 끈 상태에서 `npx vitest run`** 을 돌린다(켜져 있으면 API 라우트 테스트가 5초 타임아웃으로 무더기 실패한다).

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `web/migrations/2026-08-17-menu-items.sql` | 신규 — `menu_items` 테이블 |
| `web/schema.sql` | `menu_items` 추가 + 누락된 `lunch_specials`·`saved_places`·`withdrawals` 복원 |
| `web/lib/menu-source.ts` | 신규 — 순수 로직: 출처 라벨, 교차검증 판정, 가격 병합 |
| `web/lib/constants.ts` | `effectiveMinPrice`가 DB 메뉴를 1차로 보도록 |
| `web/app/api/menu-items/route.ts` | 신규 — GET(요약/가게별) |
| `web/components/MapApp.tsx` | DB 메뉴 요약 fetch + 가격 필터에 주입 |
| `web/components/PlacePanel.tsx` | DB 메뉴를 카카오 메뉴 위에 출처 배지와 함께 노출 |
| `web/components/SpecialSection.tsx` | 메뉴 유무에 따른 진입 문구 분기 |

---

### Task 1: 스키마 드리프트 복구

`schema.sql`에 세 테이블이 빠져 있다. 메뉴 작업과 무관한 기존 결함이지만 Task 2가 같은 파일을 건드리므로 먼저 정리한다. 새 DB를 만들면 이 테이블들이 조용히 사라지는 상태다.

**Files:**
- Modify: `web/schema.sql`

**Interfaces:**
- Produces: `schema.sql`이 `migrations/`와 같은 테이블 집합을 만든다는 보장.

- [ ] **Step 1: 드리프트 실측**

Run:
```bash
cd Bfl_map/web
diff <(grep -oiE 'CREATE TABLE (IF NOT EXISTS )?[a-z_]+' schema.sql | grep -oiE '[a-z_]+$' | sort -u) \
     <(grep -hoiE 'CREATE TABLE (IF NOT EXISTS )?[a-z_]+' migrations/*.sql | grep -oiE '[a-z_]+$' | sort -u)
```
Expected: `lunch_specials`, `saved_places`, `withdrawals` 세 개가 migrations 쪽에만 있다고 나온다.

- [ ] **Step 2: 누락 테이블을 schema.sql에 추가**

`web/schema.sql` 맨 끝(`visits` 인덱스 다음)에 추가한다. 정의는 마이그레이션에서 그대로 옮기되, 주석은 왜 그 모양인지 설명하는 한 줄만 남긴다:

```sql

-- 가게 저장(즐겨찾기). place_id에 외래 키를 걸지 않는 이유: 가게 목록은 DB가 아니라
-- public/restaurants.json에 있다. 수집을 다시 돌려 사라진 가게는 화면단에서 걸러진다.
CREATE TABLE IF NOT EXISTS saved_places (
  user_id  TEXT NOT NULL REFERENCES users (user_id),
  place_id TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, place_id)
);

-- 점심 특선 제보. PK(place_id, user_id) — 한 가게에 한 사람이 하나이고, 특선은 바뀌는
-- 거라 다시 제보하면 덮어쓴다. 쌓지 않으니 도배도 안 된다.
CREATE TABLE IF NOT EXISTS lunch_specials (
  place_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(user_id),
  menu_name  TEXT NOT NULL,
  price      INTEGER NOT NULL,
  taste      SMALLINT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, user_id)
);
```

`withdrawals`는 `migrations/2026-08-10-rejoin-block.sql`에서 정의를 그대로 읽어 같은 방식으로 옮긴다 — **정의를 기억으로 쓰지 말고 파일에서 복사할 것.**

- [ ] **Step 3: 드리프트 해소 확인**

Step 1의 `diff`를 다시 실행. Expected: 출력 없음(두 집합이 같다).

- [ ] **Step 4: Commit**

```bash
git -C "<worktree>" add Bfl_map/web/schema.sql
```
그리고 **별도 호출로**:
```bash
git -C "<worktree>" commit -m "fix(bfl-map): restore three tables missing from schema.sql"
```

---

### Task 2: menu_items 테이블

**Files:**
- Create: `web/migrations/2026-08-17-menu-items.sql`
- Modify: `web/schema.sql`

**Interfaces:**
- Produces: 테이블 `menu_items`. 이후 모든 Task가 이 컬럼 이름에 의존한다 —
  `id, place_id, menu_name, price, source_type, source_ref, collected_at, verified_at, status`.
- Consumes: Task 1이 정리한 `schema.sql`.

- [ ] **Step 1: 마이그레이션 파일 작성**

`web/migrations/2026-08-17-menu-items.sql`:

```sql
-- 출처가 기록되는 메뉴. 지금 메뉴는 restaurants.json 안의 {name, price} 배열이라
-- 출처를 적을 자리가 없고, 수집기가 매 실행 파일을 통째로 덮어써서 부분 보존도 안 된다.
--
-- price가 NULL 허용인 이유: 카카오는 미공개를 -1로 준다(20,560건 중 5,132건). 그걸
-- 그대로 옮기면 읽는 쪽마다 -1을 다시 걸러야 한다. 들어올 때 한 번 NULL로 정규화한다.
--
-- status: 제보 한 건이 곧바로 확정 데이터가 되지 않게 한다. 서로 다른 사용자 2명이
-- ±20% 안의 가격을 내면 published 로 올린다 — 담합 비용이 계정 2개다.
CREATE TABLE IF NOT EXISTS menu_items (
  id           SERIAL PRIMARY KEY,
  place_id     TEXT NOT NULL,
  menu_name    TEXT NOT NULL CHECK (length(trim(menu_name)) > 0),
  price        INTEGER CHECK (price IS NULL OR price > 0),
  source_type  TEXT NOT NULL CHECK (source_type IN
                 ('public_data','owner','user_report','official_source','legacy_import')),
  source_ref   TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','published','rejected'))
);

-- 가게별 조회가 유일한 접근 패턴이다(가격 필터용 전체 요약도 status로 먼저 좁힌다).
CREATE INDEX IF NOT EXISTS idx_menu_items_place ON menu_items (place_id, status);
```

- [ ] **Step 2: schema.sql에 같은 정의 추가**

같은 내용을 `web/schema.sql` 끝에 붙인다. **두 파일이 어긋나는 게 Task 1이 고친 바로 그 결함이다.**

- [ ] **Step 3: 두 파일이 일치하는지 확인**

Run:
```bash
cd Bfl_map/web
diff <(sed -n '/CREATE TABLE IF NOT EXISTS menu_items/,/^);/p' schema.sql) \
     <(sed -n '/CREATE TABLE IF NOT EXISTS menu_items/,/^);/p' migrations/2026-08-17-menu-items.sql)
```
Expected: 출력 없음.

- [ ] **Step 4: Commit** (add / commit 별도 호출)

```
feat(bfl-map): add menu_items, a menu table that records where each row came from
```

---

### Task 3: 순수 로직 모듈 (TDD)

DB도 React도 없는 순수 함수만 모은다. 교차검증 판정과 가격 병합은 규칙이 명시적이라 테스트로 고정하기 쉽고, 나머지 Task가 전부 여기에 의존한다.

**Files:**
- Create: `web/lib/menu-source.ts`
- Test: `web/__tests__/menu-source.test.ts`

**Interfaces:**
- Produces:
  - `type MenuSourceType = "public_data" | "owner" | "user_report" | "official_source" | "legacy_import"`
  - `type MenuStatus = "pending" | "published" | "rejected"`
  - `type DbMenuItem = { menuName: string; price: number | null; sourceType: MenuSourceType; status: MenuStatus; verifiedAt: string | null }`
  - `sourceLabel(t: MenuSourceType): string` — 화면에 쓰는 한국어 라벨
  - `PRICE_AGREEMENT_RATIO = 0.2`
  - `pricesAgree(a: number, b: number): boolean`
  - `dbMinPrice(items: DbMenuItem[]): number | null` — `published` 항목의 최저가
- Consumes: 없음.

- [ ] **Step 1: 실패하는 테스트 작성**

`web/__tests__/menu-source.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PRICE_AGREEMENT_RATIO, dbMinPrice, pricesAgree, sourceLabel } from "@/lib/menu-source";
import type { DbMenuItem } from "@/lib/menu-source";

const item = (o: Partial<DbMenuItem>): DbMenuItem => ({
  menuName: "김치찌개", price: 9000, sourceType: "user_report",
  status: "published", verifiedAt: null, ...o,
});

describe("pricesAgree", () => {
  it("같은 값은 일치한다", () => {
    expect(pricesAgree(10000, 10000)).toBe(true);
  });
  it("±20% 경계 안쪽은 일치한다", () => {
    expect(pricesAgree(10000, 12000)).toBe(true);
    expect(pricesAgree(10000, 8000)).toBe(true);
  });
  it("경계 밖은 일치하지 않는다", () => {
    expect(pricesAgree(10000, 12001)).toBe(false);
    expect(pricesAgree(10000, 7999)).toBe(false);
  });
  it("기준을 어느 쪽에 두든 같은 답이 나온다 — 큰 쪽 기준이면 8000/10000이 갈린다", () => {
    expect(pricesAgree(8000, 10000)).toBe(pricesAgree(10000, 8000));
  });
  it("비율 상수가 스펙과 같다", () => {
    expect(PRICE_AGREEMENT_RATIO).toBe(0.2);
  });
});

describe("dbMinPrice", () => {
  it("항목이 없으면 null", () => {
    expect(dbMinPrice([])).toBeNull();
  });
  it("published 중 최저가를 고른다", () => {
    expect(dbMinPrice([item({ price: 12000 }), item({ price: 8000 })])).toBe(8000);
  });
  it("pending 은 세지 않는다 — 확정 안 된 값이 필터를 통과시키면 안 된다", () => {
    expect(dbMinPrice([item({ price: 5000, status: "pending" }), item({ price: 9000 })])).toBe(9000);
  });
  it("rejected 는 세지 않는다", () => {
    expect(dbMinPrice([item({ price: 100, status: "rejected" })])).toBeNull();
  });
  it("가격 없는 항목(NULL)은 건너뛴다", () => {
    expect(dbMinPrice([item({ price: null }), item({ price: 7000 })])).toBe(7000);
  });
  it("가격이 전부 NULL이면 null", () => {
    expect(dbMinPrice([item({ price: null })])).toBeNull();
  });
});

describe("sourceLabel", () => {
  it("다섯 출처 모두 라벨이 있다", () => {
    for (const t of ["public_data", "owner", "user_report", "official_source", "legacy_import"] as const) {
      expect(sourceLabel(t).length).toBeGreaterThan(0);
    }
  });
  it("업주 제공과 이용자 제보는 다른 말로 표시된다", () => {
    expect(sourceLabel("owner")).not.toBe(sourceLabel("user_report"));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd Bfl_map/web && npx vitest run __tests__/menu-source.test.ts`
Expected: FAIL — `Cannot find module '@/lib/menu-source'`.

- [ ] **Step 3: 최소 구현**

`web/lib/menu-source.ts`:

```ts
/**
 * 메뉴 한 줄이 어디서 왔는지. 이 다섯 개가 전부이고 DB의 CHECK 제약과 같은 집합이다.
 *
 * legacy_import는 카카오 비공식 endpoint에서 온 기존 데이터를 위한 자리다. 다른
 * 출처와 섞이면 "숨기고 순차 교체"라는 선택지 자체가 구현 불가능해진다.
 */
export type MenuSourceType =
  | "public_data" | "owner" | "user_report" | "official_source" | "legacy_import";

export type MenuStatus = "pending" | "published" | "rejected";

export type DbMenuItem = {
  menuName: string;
  /** 가격 미상은 NULL이다. 카카오의 -1은 DB로 들어올 때 여기서 정규화된다. */
  price: number | null;
  sourceType: MenuSourceType;
  status: MenuStatus;
  verifiedAt: string | null;
};

const LABELS: Record<MenuSourceType, string> = {
  public_data: "공공데이터",
  owner: "가게 제공",
  user_report: "이용자 제보",
  official_source: "공식 출처",
  legacy_import: "출처 확인 중",
};

export function sourceLabel(t: MenuSourceType): string {
  return LABELS[t];
}

/** 서로 다른 두 사람의 제보가 같은 가격을 말한 것으로 볼 허용 오차. */
export const PRICE_AGREEMENT_RATIO = 0.2;

/**
 * 두 제보 가격이 일치한다고 볼지.
 *
 * 기준을 작은 쪽에 둔다. 큰 쪽에 두면 8,000과 10,000이 방향에 따라 갈린다 —
 * 10,000의 20%는 2,000이라 통과지만 8,000의 20%는 1,600이라 탈락이다. 어느 쪽을
 * 먼저 넣었느냐로 답이 달라지면 판정이 아니다.
 */
export function pricesAgree(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.min(a, b) * PRICE_AGREEMENT_RATIO;
}

/**
 * 가격 필터가 볼 그 가게의 DB 최저가.
 *
 * published만 센다. pending을 세면 확정되지 않은 한 사람의 제보가 필터를
 * 통과시키게 되고, 그게 이 status 컬럼을 만든 이유를 무효로 만든다.
 */
export function dbMinPrice(items: DbMenuItem[]): number | null {
  let min: number | null = null;
  for (const it of items) {
    if (it.status !== "published") continue;
    if (it.price === null || !Number.isFinite(it.price) || it.price <= 0) continue;
    if (min === null || it.price < min) min = it.price;
  }
  return min;
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd Bfl_map/web && npx vitest run __tests__/menu-source.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit** (add / commit 별도 호출)

```
feat(bfl-map): add menu provenance types and the cross-check rule
```

---

### Task 4: effectiveMinPrice가 DB를 먼저 보게

가격 필터가 카카오에서 떨어져 나오는 지점이다. 이 Task 이후에는 DB에 published 메뉴가 있는 가게가 카카오 메뉴 없이도 필터를 통과한다.

**Files:**
- Modify: `web/lib/constants.ts` (84~92행 `effectiveMinPrice`)
- Test: `web/__tests__/price.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 3의 `dbMinPrice`, `DbMenuItem`.
- Produces: `effectiveMinPrice(menus, special, dbItems?)` — **세 번째 인자는 선택**이다. 기존 호출부(`MapApp.tsx:136,144`)가 인자 두 개로 부르고 있고, 그게 계속 컴파일되어야 한다.

- [ ] **Step 1: 실패하는 테스트 추가**

`web/__tests__/price.test.ts` 끝에 붙인다:

```ts
import { dbMinPrice } from "@/lib/menu-source";
import type { DbMenuItem } from "@/lib/menu-source";

const db = (price: number | null, status: DbMenuItem["status"] = "published"): DbMenuItem => ({
  menuName: "메뉴", price, sourceType: "user_report", status, verifiedAt: null,
});

describe("effectiveMinPrice — DB 메뉴 우선", () => {
  it("세 번째 인자 없이 부르면 기존과 같다", () => {
    expect(effectiveMinPrice([{ price: "9000" }], undefined)).toBe(9000);
  });
  it("DB 메뉴가 카카오보다 싸면 DB를 쓴다", () => {
    expect(effectiveMinPrice([{ price: "12000" }], undefined, [db(7000)])).toBe(7000);
  });
  it("카카오가 더 싸도 DB 값이 있으면 둘 중 싼 쪽이다", () => {
    expect(effectiveMinPrice([{ price: "6000" }], undefined, [db(9000)])).toBe(6000);
  });
  it("카카오 메뉴가 없어도 DB만으로 가격이 나온다 — 크롤러를 꺼도 필터가 산다", () => {
    expect(effectiveMinPrice([], undefined, [db(8000)])).toBe(8000);
  });
  it("DB에 pending만 있으면 가격이 없는 것으로 본다", () => {
    expect(effectiveMinPrice([], undefined, [db(3000, "pending")])).toBeNull();
  });
  it("제보 특선과 DB 메뉴가 함께 있으면 셋 중 최저가", () => {
    expect(effectiveMinPrice([{ price: "12000" }], { menuName: "특선", price: 10000 }, [db(8000)])).toBe(8000);
  });
  it("셋 다 없으면 null", () => {
    expect(effectiveMinPrice([], undefined, [])).toBeNull();
  });
  it("dbMinPrice와 같은 판정을 쓴다", () => {
    const items = [db(5000, "rejected"), db(9000)];
    expect(effectiveMinPrice([], undefined, items)).toBe(dbMinPrice(items));
  });
});
```

기존 파일 상단의 `import` 줄에 `effectiveMinPrice`가 이미 있는지 확인하고, 없으면 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `cd Bfl_map/web && npx vitest run __tests__/price.test.ts`
Expected: FAIL — 세 번째 인자를 받지 않으므로 DB 케이스가 전부 카카오 값만 돌려준다.

- [ ] **Step 3: 구현**

`web/lib/constants.ts`의 `effectiveMinPrice`를 교체한다:

```ts
/**
 * 가격 필터가 보는 그 가게의 최저가. 출처가 다른 세 값 중 가장 싼 것이다.
 *
 * DB 메뉴(menu_items)를 먼저 본다. 카카오 메뉴는 fallback이다 — 이 순서가
 * 뒤집혀 있는 동안에는 크롤러를 끄는 순간 필터의 후보가 전멸했다.
 * dbItems를 넘기지 않으면 예전과 똑같이 동작한다.
 */
export function effectiveMinPrice(
  menus: { price: string }[],
  special: SpecialPrice | undefined,
  dbItems?: DbMenuItem[],
): number | null {
  const candidates: number[] = [];
  const fromDb = dbItems ? dbMinPrice(dbItems) : null;
  if (fromDb !== null) candidates.push(fromDb);
  const kakao = minMenuPrice(menus);
  if (kakao !== null) candidates.push(kakao);
  if (special) candidates.push(special.price);
  return candidates.length === 0 ? null : Math.min(...candidates);
}
```

파일 상단에 import를 추가한다:
```ts
import { type DbMenuItem, dbMinPrice } from "@/lib/menu-source";
```

- [ ] **Step 4: 통과 확인 + 회귀 확인**

Run: `cd Bfl_map/web && npx vitest run` (dev 서버 끈 상태)
Expected: 전부 통과. 기존 `price.test.ts`의 두-인자 케이스가 하나도 깨지지 않아야 한다 — 깨졌다면 선택 인자 처리가 틀린 것이다.

- [ ] **Step 5: 타입 확인**

Run: `cd Bfl_map/web && npx tsc --noEmit`
Expected: 통과. `MapApp.tsx`가 인자 두 개로 부르는 곳이 그대로 컴파일되어야 한다.

- [ ] **Step 6: Commit** (add / commit 별도 호출)

```
feat(bfl-map): let the price filter read DB menus before the crawled ones
```

---

### Task 5: GET /api/menu-items

**Files:**
- Create: `web/app/api/menu-items/route.ts`
- Test: `web/__tests__/menu-items-route.test.ts`

**Interfaces:**
- Consumes: Task 2의 테이블, Task 3의 타입.
- Produces: 두 가지 응답 모양.
  - `GET /api/menu-items` (placeId 없음) → `{ items: { place_id: string; price: number }[] }` — 가게별 **published 최저가 하나**. 가격 필터가 지도 전체를 한 번에 봐야 해서 가게별 왕복이 불가능하다. `/api/specials`의 같은 패턴을 따른다.
  - `GET /api/menu-items?placeId=<digits>` → `{ items: { menu_name, price, source_type, status, verified_at, collected_at }[] }`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/__tests__/menu-items-route.test.ts`. 기존 라우트 테스트가 `@/lib/db`를 어떻게 모킹하는지 **`__tests__/admin-stats-route.test.ts`를 먼저 읽고 같은 방식을 쓸 것.** 검증할 것:

```ts
// placeId 없이 부르면 가게별 요약이 온다
// placeId가 숫자가 아니면 400
// placeId가 유효하면 그 가게 항목만 온다
// rejected 항목은 어느 응답에도 안 나온다
```

- [ ] **Step 2: 실패 확인**

Run: `cd Bfl_map/web && npx vitest run __tests__/menu-items-route.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`web/app/api/menu-items/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { PLACE_ID_RE } from "@/lib/constants";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");

  // placeId 없이 부르면 가격 필터용 요약이다: 가게마다 확정된 최저가 하나.
  // 필터는 지도의 모든 가게를 한 번에 봐야 해서 가게별 왕복으로는 못 만든다.
  // (/api/specials가 같은 이유로 같은 모양을 쓴다.)
  if (placeId === null) {
    const items = await sql`
      SELECT DISTINCT ON (place_id) place_id, price
      FROM menu_items
      WHERE status = 'published' AND price IS NOT NULL
      ORDER BY place_id, price ASC`;
    return NextResponse.json({ items });
  }

  if (!PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ error: "placeId가 필요합니다." }, { status: 400 });
  }
  // rejected는 내보내지 않는다. pending은 내보내되 화면이 확정과 구분해 표시한다.
  const items = await sql`
    SELECT menu_name, price, source_type, status, verified_at, collected_at
    FROM menu_items
    WHERE place_id = ${placeId} AND status <> 'rejected'
    ORDER BY status DESC, price ASC NULLS LAST
    LIMIT 50`;
  return NextResponse.json({ items });
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd Bfl_map/web && npx vitest run __tests__/menu-items-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (add / commit 별도 호출)

```
feat(bfl-map): serve DB menus, summary for the filter and detail per place
```

---

### Task 6: MapApp이 DB 메뉴를 가격 필터에 넣는다

**Files:**
- Modify: `web/components/MapApp.tsx`

**Interfaces:**
- Consumes: Task 5의 요약 응답, Task 4의 세 번째 인자.

- [ ] **Step 1: 상태와 fetch 추가**

`specialPrices` 바로 아래에 같은 모양으로 둔다(40행 근처):

```tsx
// 가게별 확정 메뉴 최저가. specialPrices와 같은 이유로 요약 하나만 받는다.
const [dbMinPrices, setDbMinPrices] = useState<Map<string, number>>(new Map());
```

기존 `fetch("/api/specials")` 블록(79~91행) 바로 뒤에 붙인다:

```tsx
fetch("/api/menu-items")
  .then(r => r.json())
  .then(d =>
    setDbMinPrices(
      new Map((d.items ?? []).map((x: { place_id: string; price: number }) => [x.place_id, x.price])),
    ),
  )
  .catch(() => {});
```

- [ ] **Step 2: 가격 필터 두 곳에 주입**

`effectiveMinPrice` 호출이 두 군데다(`unpricedCount` 계산과 `ranked` 계산). 둘 다 세 번째 인자를 넘긴다. `dbMinPrices`는 최저가 숫자만 담으므로, 그 자리에서 `DbMenuItem` 한 건으로 감싼다:

```tsx
const dbItemsFor = useCallback(
  (placeId: string): DbMenuItem[] => {
    const p = dbMinPrices.get(placeId);
    // 요약 응답은 이미 published 최저가만 담고 있다 — 여기서 다시 판정하지 않는다.
    return p === undefined
      ? []
      : [{ menuName: "", price: p, sourceType: "user_report", status: "published", verifiedAt: null }];
  },
  [dbMinPrices],
);
```

그리고 두 `useMemo`의 의존 배열에 `dbItemsFor`를 추가한다 — **빠뜨리면 DB 메뉴가 도착해도 필터가 다시 계산되지 않는다.**

- [ ] **Step 3: 타입·린트·테스트·빌드**

Run (dev 서버 끈 상태):
```bash
cd Bfl_map/web && npx tsc --noEmit && npm run lint && npx vitest run
DATABASE_URL="postgres://u:p@localhost:5432/db" ADMIN_SESSION_SECRET="x" SESSION_SECRET="x" npm run build
```
Expected: 전부 통과.

- [ ] **Step 4: Commit** (add / commit 별도 호출)

```
feat(bfl-map): feed DB menu prices into the price filter
```

---

### Task 7: PlacePanel이 출처와 함께 보여준다

**Files:**
- Modify: `web/components/PlacePanel.tsx` (66~87행 메뉴 블록)

**Interfaces:**
- Consumes: Task 5의 가게별 응답, Task 3의 `sourceLabel`.

- [ ] **Step 1: DB 메뉴를 카카오 메뉴 위에 배치**

메뉴 섹션의 순서는 **DB 메뉴 → 카카오 메뉴** 다. 출처가 분명한 쪽이 위다.

각 DB 메뉴 줄에 `sourceLabel(source_type)` 배지를 붙인다. 배지는 `MenuLines`의 `특선` 배지와 같은 모양을 쓴다 — `rounded bg-tertiary-container px-1 py-0.5 text-[10px] font-bold text-on-tertiary-container`.

`status === "pending"`인 항목은 배지 옆에 "미확인"을 덧붙인다.

`verified_at`이 있으면 그 날짜를 `text-[11px] text-on-surface-variant`로 한 줄 아래에 적는다. 없으면 아무것도 적지 않는다 — 빈 자리를 만들지 않는다.

- [ ] **Step 2: 카카오 메뉴 블록에 출처를 명시**

기존 카카오 메뉴 목록 위에 한 줄 추가한다. 지금은 출처 표시가 전혀 없다:

```tsx
<p className="mt-2 text-[11px] text-on-surface-variant">카카오맵에서 가져온 정보예요.</p>
```

- [ ] **Step 3: 빈 상태 문구 수정**

DB·카카오 둘 다 없을 때만 "메뉴 정보 없음"을 띄운다. 지금은 `r.menus.length === 0`만 본다.

- [ ] **Step 4: 검증**

Run: 타입·린트·테스트·빌드(Task 6 Step 3과 동일). 그리고 dev 서버를 띄워 메뉴 있는 가게와 없는 가게를 각각 열어 육안 확인.

- [ ] **Step 5: Commit** (add / commit 별도 호출)

```
feat(bfl-map): show where each menu line came from
```

---

### Task 8: 메뉴 없는 가게의 제보 진입 문구

**Files:**
- Modify: `web/components/SpecialSection.tsx`
- Modify: `web/components/PlacePanel.tsx` (prop 전달)

**Interfaces:**
- Consumes: 없음.
- Produces: `SpecialSection`이 `hasMenus: boolean` prop을 받는다.

- [ ] **Step 1: prop 추가와 문구 분기**

`SpecialSection`의 props를 `{ placeId, loggedIn, hasMenus }`로 넓힌다. 제목·안내·버튼 세 곳이 갈린다:

| | `hasMenus === true` (현행) | `hasMenus === false` |
|---|---|---|
| 제목 | 점심 특선 <span>제보받아요</span> | 이 집 메뉴를 아시나요? |
| 빈 상태 | 아직 제보가 없어요. 이 집 점심특선을 아신다면 알려주세요. | 드셔보신 메뉴와 가격을 알려주세요. |
| 버튼 | 점심 특선 제보하기 | 메뉴 알려주기 |

`SPECIAL_DISCLAIMER`는 두 경우 모두 그대로 노출한다 — 제보가 확인된 정보가 아니라는 말은 상황과 무관하다.

- [ ] **Step 2: PlacePanel에서 전달**

```tsx
<SpecialSection placeId={r.kakao_place_id} loggedIn={user !== null} hasMenus={r.menus.length > 0} />
```

- [ ] **Step 3: 검증 + 육안 확인**

메뉴 0개인 가게(전체의 23.9%, 1,392곳 중 아무거나)를 열어 새 문구가 뜨는지 확인.

- [ ] **Step 4: Commit** (add / commit 별도 호출)

```
feat(bfl-map): ask for the menu itself when a place has none
```

---

## Self-Review 체크리스트

- [x] 스펙의 `menu_items` 스키마가 Task 2에 그대로 반영됨(다섯 출처, 세 status, price NULL 허용)
- [x] 스펙의 "가격 필터를 먼저 이관" 결정이 Task 4에 반영됨
- [x] 스펙의 "제보 UI 새로 만들지 않음"이 Task 8에 반영됨(기존 컴포넌트 prop 확장)
- [x] 스펙의 "스키마 드리프트 같이 고침"이 Task 1에 반영됨
- [x] 스펙의 "하지 않는 것" 다섯 개가 Global Constraints에 전부 있음
- [x] 교차검증 ±20%·2명이 Task 3에 상수와 테스트로 고정됨
- [x] 타입 일관성 — Task 4~7이 전부 Task 3의 `DbMenuItem`/`dbMinPrice`를 참조
- [x] 기존 호출부 호환 — `effectiveMinPrice` 세 번째 인자를 선택으로 두고 Task 4 Step 5에서 확인
- [x] 플레이스홀더 없음

## 이 계획이 끝나도 남는 것

- **크롤러는 여전히 돌아간다.** 끄는 결정은 커버리지 실측 후.
- **`legacy_import` 데이터가 아직 없다.** 기존 20,560건을 DB로 옮기는 작업은 이 계획 밖이다 — 옮길지 말지가 A/B/C 선택 그 자체이기 때문이다.
- **`published`로 올려주는 코드가 없다.** Task 3이 판정 규칙을 만들고 Task 5가 `published`만 읽지만, 실제로 승격시키는 쓰기 경로(POST)는 이 계획에 없다. 제보가 쌓이기 시작한 뒤 별도로 붙인다.
- **`lunch_specials`와 `menu_items`가 공존한다.** 통합 여부는 나중 결정이다.
