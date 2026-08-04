# 서비스 전용 표시 닉네임 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 카카오/구글 본명 대신 서비스 안에서만 쓰는 표시 닉네임을 갖게 한다.

**Architecture:** 닉네임의 유일한 출처는 새 `users` 테이블이다. 세션 JWT는 `sub`(userId)만 싣고 표시 이름은 매번 DB에서 읽으므로, 닉네임을 바꾸면 과거 리뷰까지 함께 바뀐다. 프로바이더가 준 이름은 OAuth 콜백에서 받는 즉시 버린다. 첫 로그인 사용자는 홈 화면에 뜨는 닫을 수 없는 모달에서 닉네임을 정하고, 서버는 닉네임 없는 세션의 리뷰 작성을 409로 막는다.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript, Neon Postgres (`@neondatabase/serverless`), jose(JWT), vitest, Tailwind

**작업 브랜치:** `feature/bfl-map-nickname` (이미 생성됨, 스펙 커밋 `79ff6ab` 포함)

**실행 순서: 1 → 2 → 5 → 3 → 4 → 6 → 7.** 태스크 번호는 아래 문서 순서를 그대로 두되,
Task 2가 세션 시그니처를 바꾸는 순간 `reviews/route.ts`와 그 테스트가 컴파일되지 않으므로
그걸 고치는 Task 5를 곧바로 이어 붙인다. Task 5의 테스트는 DB를 목으로 대체하므로
마이그레이션(Task 3)보다 먼저 와도 통과한다. 실제 실행이 필요한 Task 6 이전에
마이그레이션이 끝나 있으면 된다.

## Global Constraints

- 닉네임 길이는 **2~12자**, 코드 포인트 기준(`[...s].length`)으로 센다.
- 허용 문자는 **한글·영문·숫자·밑줄**뿐. 정규식 `/^[가-힣a-zA-Z0-9_]+$/`. 공백·특수문자·이모지·자모 단독은 거부.
- 닉네임에도 리뷰 본문과 **같은 욕설 필터** `containsProfanity`(`@/lib/profanity`)를 적용한다.
- **닉네임 중복을 허용한다.** `users.nickname`에 UNIQUE 제약을 걸지 않는다.
- **프로바이더가 준 이름(본명)은 어디에도 저장하지 않는다.** DB에도, JWT에도 넣지 않는다.
- 모든 API 에러 응답은 `{ "error": "<한국어 문장>" }` 모양으로 통일한다(기존 리뷰 API와 동일).
- 자동 제안 닉네임은 `점심러` + 4자리 숫자(1000–9999).
- 작업 디렉터리는 전부 `Bfl_map/web/`. 명령은 그 안에서 실행한다.
- 이 저장소는 Windows다. 한글이 든 파일은 Read/Edit/Write 도구로만 다룬다(PowerShell 텍스트 파이프라인 금지).

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `web/lib/nickname.ts` | 닉네임 검증과 자동 제안값 생성. 순수 함수만, DB·네트워크 없음 |
| `web/__tests__/nickname.test.ts` | 위 모듈의 경계값 테스트 |
| `web/app/api/auth/nickname/route.ts` | `PUT` 하나로 최초 설정과 변경을 겸함 |
| `web/__tests__/nickname-route.test.ts` | 401/400/200 경로 테스트 |
| `web/components/NicknameModal.tsx` | 최초 설정·변경 공용 모달 |
| `web/migrations/2026-08-04-users-nickname.sql` | users 테이블 생성 + 백필 + FK + 컬럼 제거 |

**수정**

| 파일 | 변경 |
|---|---|
| `web/lib/session.ts` | JWT에서 `nickname` 클레임 제거, `createSessionToken(userId)` 시그니처 변경 |
| `web/app/api/auth/kakao/callback/route.ts` | 프로바이더 이름을 세션에 싣지 않음 |
| `web/app/api/auth/google/callback/route.ts` | 동일 |
| `web/app/api/auth/me/route.ts` | 닉네임을 DB에서 읽어 반환 |
| `web/app/api/reviews/route.ts` | GET은 `users` 조인, POST는 409 가드 + `nickname` 컬럼 미기록 |
| `web/app/page.tsx` | 모달 연결, 헤더 닉네임 클릭 시 변경 |
| `web/schema.sql` | users 테이블 반영, `reviews.nickname` 제거 |
| `web/__tests__/session.test.ts` | 새 시그니처 + 구 토큰 호환 테스트 |
| `web/__tests__/reviews.test.ts` | `hasNickname` 추가로 깨지는 기존 목 수정 + 409 테스트 |

---

### Task 1: 닉네임 검증 모듈

순수 함수부터 만든다. DB도 라우트도 없이 규칙만 확정하면 뒤 작업이 이걸 그대로 쓴다.

**Files:**
- Create: `web/lib/nickname.ts`
- Test: `web/__tests__/nickname.test.ts`

**Interfaces:**
- Consumes: `containsProfanity(text: string): boolean` from `@/lib/profanity`
- Produces:
  - `validateNickname(input: unknown): { ok: true; value: string } | { ok: false; error: string }`
  - `suggestNickname(): string`
  - `NICKNAME_MIN_LEN = 2`, `NICKNAME_MAX_LEN = 12`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/nickname.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  NICKNAME_MAX_LEN,
  NICKNAME_MIN_LEN,
  suggestNickname,
  validateNickname,
} from "@/lib/nickname";

describe("validateNickname", () => {
  it("accepts a plain Korean nickname", () => {
    expect(validateNickname("점심러4821")).toEqual({ ok: true, value: "점심러4821" });
  });

  it("counts Korean length by code point, not by byte", () => {
    expect(validateNickname("가".repeat(NICKNAME_MAX_LEN)).ok).toBe(true);
    expect(validateNickname("가".repeat(NICKNAME_MAX_LEN + 1)).ok).toBe(false);
  });

  it("rejects a nickname shorter than the minimum", () => {
    expect(validateNickname("가".repeat(NICKNAME_MIN_LEN - 1)).ok).toBe(false);
    expect(validateNickname("가".repeat(NICKNAME_MIN_LEN)).ok).toBe(true);
  });

  it("allows latin letters, digits and underscore", () => {
    expect(validateNickname("lunch_42").ok).toBe(true);
  });

  it("rejects whitespace, punctuation and emoji", () => {
    expect(validateNickname("점심 러").ok).toBe(false);
    expect(validateNickname("점심러!").ok).toBe(false);
    expect(validateNickname("점심러🍜").ok).toBe(false);
  });

  it("rejects bare jamo", () => {
    expect(validateNickname("ㄱㄴ").ok).toBe(false);
    expect(validateNickname("ㅏㅑ").ok).toBe(false);
  });

  it("rejects profanity", () => {
    expect(validateNickname("씨발러").ok).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(validateNickname(undefined).ok).toBe(false);
    expect(validateNickname(42).ok).toBe(false);
    expect(validateNickname(null).ok).toBe(false);
  });

  it("returns a Korean error message on every rejection", () => {
    const r = validateNickname("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/[가-힣]/);
  });
});

describe("suggestNickname", () => {
  it("always produces a value the validator accepts", () => {
    for (let i = 0; i < 200; i++) {
      expect(validateNickname(suggestNickname()).ok).toBe(true);
    }
  });

  it("uses the 점심러 + 4 digit shape", () => {
    expect(suggestNickname()).toMatch(/^점심러\d{4}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- nickname.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/nickname"`

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/nickname.ts`:

```ts
import { containsProfanity } from "@/lib/profanity";

export const NICKNAME_MIN_LEN = 2;
export const NICKNAME_MAX_LEN = 12;

// 한글 완성형·영문·숫자·밑줄만. 자모 단독(ㄱ, ㅏ)은 가-힣 범위 밖이라 자연히 걸러진다.
const CHARSET_RE = /^[가-힣a-zA-Z0-9_]+$/;

export function validateNickname(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "닉네임을 입력해주세요." };
  const value = input.normalize("NFC");
  const len = [...value].length;
  if (len < NICKNAME_MIN_LEN || len > NICKNAME_MAX_LEN) {
    return { ok: false, error: `닉네임은 ${NICKNAME_MIN_LEN}~${NICKNAME_MAX_LEN}자여야 해요.` };
  }
  if (!CHARSET_RE.test(value)) {
    return { ok: false, error: "한글, 영문, 숫자, 밑줄만 쓸 수 있어요." };
  }
  if (containsProfanity(value)) {
    return { ok: false, error: "부적절한 표현이 포함되어 있습니다." };
  }
  return { ok: true, value };
}

const SUGGEST_PREFIX = "점심러";

/** 첫 로그인 모달의 입력칸에 미리 채워 넣을 값. 중복을 허용하므로 충돌은 검사하지 않는다. */
export function suggestNickname(): string {
  return `${SUGGEST_PREFIX}${1000 + Math.floor(Math.random() * 9000)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- nickname.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add Bfl_map/web/lib/nickname.ts Bfl_map/web/__tests__/nickname.test.ts
git commit -m "feat: add nickname validation and suggestion"
```

---

### Task 2: 세션에서 본명 제거

JWT가 프로바이더 이름을 싣고 다니는 게 본명 노출의 직접 원인이다. 여기를 먼저 끊는다.

**Files:**
- Modify: `web/lib/session.ts:3` (타입), `web/lib/session.ts:38-55` (create/verify)
- Modify: `web/app/api/auth/kakao/callback/route.ts:24-28`
- Modify: `web/app/api/auth/google/callback/route.ts:24-28`
- Test: `web/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `namespacedUserId(provider, accountId)` — 변경 없음
- Produces:
  - `type Session = { userId: string }`
  - `createSessionToken(userId: string): Promise<string>`
  - `verifySessionToken(token: string): Promise<Session | null>`
  - `SESSION_COOKIE`, `sessionCookieOptions` — 변경 없음

- [ ] **Step 1: Write the failing test**

Replace the whole body of `web/__tests__/session.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";

const SECRET = "test-secret-at-least-32-chars-long!!";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("session token", () => {
  it("round-trips a user id", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await createSessionToken("google:sub-42");
    expect(await verifySessionToken(token)).toEqual({ userId: "google:sub-42" });
  });

  it("does not carry a nickname claim", async () => {
    const { createSessionToken } = await import("@/lib/session");
    const token = await createSessionToken("kakao:99");
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    expect(payload.nickname).toBeUndefined();
  });

  it("still accepts an already-issued token that carries a nickname claim", async () => {
    // 배포 전에 발급된 세션을 강제 로그아웃시키지 않기 위한 호환 경로
    const legacy = await new SignJWT({ nickname: "본명" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("kakao:legacy")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(SECRET));
    const { verifySessionToken } = await import("@/lib/session");
    expect(await verifySessionToken(legacy)).toEqual({ userId: "kakao:legacy" });
  });

  it("rejects a tampered token", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await createSessionToken("42");
    expect(await verifySessionToken(token + "x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- session.test.ts`
Expected: FAIL — `createSessionToken("google:sub-42")` 이 객체를 기대해 `nickname` 클레임이 `undefined`로 들어가거나 타입 에러

- [ ] **Step 3: Write minimal implementation**

In `web/lib/session.ts`, replace the `SessionUser` type and both token functions:

```ts
/** 세션이 들고 다니는 전부. 표시 이름은 여기 없고 users 테이블에서 읽는다. */
export type Session = { userId: string };
```

```ts
export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SEVEN_DAYS_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    // sub만 요구한다. 배포 전에 발급된 토큰에는 nickname 클레임이 남아 있는데,
    // 그걸 무시하고 통과시켜야 기존 로그인 사용자가 강제로 로그아웃되지 않는다.
    if (typeof payload.sub !== "string" || payload.sub === "") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
```

Delete the now-unused `SessionUser` export.

In **both** `web/app/api/auth/kakao/callback/route.ts` and `web/app/api/auth/google/callback/route.ts`, replace the `createSessionToken({...})` call. Kakao version:

```ts
    const token = await exchangeToken(base, code);
    const account = await fetchKakaoUser(token);
    const res = NextResponse.redirect(`${base}/`);
    res.cookies.set(
      SESSION_COOKIE,
      // account.nickname(카카오 프로필 이름)은 쓰지 않고 버린다 — 대개 본명이다.
      await createSessionToken(namespacedUserId("kakao", account.userId)),
      sessionCookieOptions,
    );
```

Google version is identical except `fetchGoogleUser` / `namespacedUserId("google", ...)` / the `google_oauth_state` cookie delete that already follows.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- session.test.ts`
Expected: PASS (4 tests)

Run: `npx tsc --noEmit`
Expected: 아직 실패한다. 남아야 하는 에러는 **정확히 두 곳**뿐이다:

- `app/api/reviews/route.ts` — `user.nickname` 참조 (INSERT 값과 DO UPDATE 절)
- `__tests__/reviews.test.ts` — `createSessionToken`에 객체를 넘김

바로 다음 순서인 Task 5가 이 둘을 정리한다. **다른 파일에서 에러가 나면 이번 변경이 잘못된 것이다.** `app/page.tsx`는 `SessionUser`를 자기 파일 안에서 따로 정의하므로 여기서는 영향받지 않는다.

- [ ] **Step 5: Commit**

```bash
git add Bfl_map/web/lib/session.ts Bfl_map/web/app/api/auth/kakao/callback/route.ts Bfl_map/web/app/api/auth/google/callback/route.ts Bfl_map/web/__tests__/session.test.ts
git commit -m "feat: drop provider display name from the session token"
```

---

### Task 3: users 테이블 마이그레이션

**Files:**
- Create: `web/migrations/2026-08-04-users-nickname.sql`
- Modify: `web/schema.sql`

**Interfaces:**
- Produces: `users(user_id TEXT PK, nickname TEXT NOT NULL, created_at, updated_at)`, `reviews`에서 `nickname` 컬럼 제거, `reviews.user_id → users.user_id` 외래 키

- [ ] **Step 1: Write the migration**

Create `web/migrations/2026-08-04-users-nickname.sql`:

```sql
-- 표시 닉네임을 users 한 곳으로 옮긴다.
-- 반드시 새 코드 배포 "전에" 실행한다. 순서가 바뀌면 배포된 코드가
-- 아직 없는 users 테이블을 조인해 500이 난다.

CREATE TABLE IF NOT EXISTS users (
  user_id    TEXT PRIMARY KEY,   -- 'kakao:123' / 'google:abc'
  nickname   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기존 리뷰에 박혀 있던 이름을 잃지 않도록 먼저 옮긴다.
-- 한 사람이 여러 리뷰를 썼다면 가장 최근 것을 채택한다.
INSERT INTO users (user_id, nickname)
  SELECT DISTINCT ON (user_id) user_id, nickname
  FROM reviews
  ORDER BY user_id, updated_at DESC
ON CONFLICT (user_id) DO NOTHING;

-- "users 행 없는 리뷰"라는 상태를 아예 만들 수 없게 한다.
-- 그래야 조회가 INNER JOIN 하나로 끝난다.
ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_fk FOREIGN KEY (user_id) REFERENCES users (user_id);

ALTER TABLE reviews DROP COLUMN nickname;
```

- [ ] **Step 2: Update the canonical schema**

In `web/schema.sql`, delete line 5 (`nickname TEXT NOT NULL,`) from the `reviews` table and prepend the `users` table above it, so a fresh database built from `schema.sql` matches a migrated one:

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id    TEXT PRIMARY KEY,   -- 'kakao:123' / 'google:abc'
  nickname   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  place_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users (user_id),
  taste         SMALLINT NOT NULL CHECK (taste BETWEEN 1 AND 5),
  waiting       SMALLINT NOT NULL CHECK (waiting BETWEEN 1 AND 5),
  body          VARCHAR(100) NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (place_id, user_id)
);
```

`user_id`의 주석 `-- google account sub`도 지운다. 이제 두 프로바이더 모두를 담는다.

- [ ] **Step 3: Run the migration against Neon**

Neon 콘솔 → 해당 프로젝트 → **SQL Editor** 에 `web/migrations/2026-08-04-users-nickname.sql` 내용을 붙여 넣고 실행한다. `schema.sql`도 같은 방식으로 적용됐다.

- [ ] **Step 4: Verify the migration took**

Neon SQL Editor에서 실행:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'reviews' ORDER BY ordinal_position;
```
Expected: `nickname`이 목록에 **없다**.

```sql
SELECT count(*) AS orphans FROM reviews r
LEFT JOIN users u ON u.user_id = r.user_id WHERE u.user_id IS NULL;
```
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add Bfl_map/web/migrations/2026-08-04-users-nickname.sql Bfl_map/web/schema.sql
git commit -m "feat: move display names into a users table"
```

---

### Task 4: 닉네임 API와 /api/auth/me

**Files:**
- Create: `web/app/api/auth/nickname/route.ts`
- Create: `web/__tests__/nickname-route.test.ts`
- Modify: `web/app/api/auth/me/route.ts`

**Interfaces:**
- Consumes: `validateNickname` (Task 1), `verifySessionToken`/`SESSION_COOKIE` (Task 2), `sql` from `@/lib/db`, `users` 테이블 (Task 3)
- Produces:
  - `PUT /api/auth/nickname` — 요청 `{ nickname: string }`, 성공 `200 { nickname: string }`
  - `GET /api/auth/me` — `{ user: null }` 또는 `{ user: { userId: string; nickname: string | null } }`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/nickname-route.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function putNickname(nickname: unknown, opts: { authed: boolean } = { authed: true }) {
  const { PUT } = await import("@/app/api/auth/nickname/route");
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.authed) {
    headers.cookie = `${SESSION_COOKIE}=${await createSessionToken("kakao:1")}`;
  }
  return PUT(
    new NextRequest("http://localhost/api/auth/nickname", {
      method: "PUT",
      headers,
      body: JSON.stringify({ nickname }),
    }),
  );
}

describe("PUT /api/auth/nickname", () => {
  it("rejects an anonymous caller", async () => {
    const res = await putNickname("점심러4821", { authed: false });
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid nickname without touching the database", async () => {
    const res = await putNickname("점심 러");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "한글, 영문, 숫자, 밑줄만 쓸 수 있어요." });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects profanity", async () => {
    const res = await putNickname("씨발러");
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("upserts a valid nickname", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await putNickname("점심러4821");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러4821" });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- nickname-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/auth/nickname/route"`

- [ ] **Step 3: Write minimal implementation**

Create `web/app/api/auth/nickname/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateNickname } from "@/lib/nickname";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const raw =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>).nickname
      : undefined;
  const v = validateNickname(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await sql`
    INSERT INTO users (user_id, nickname) VALUES (${session.userId}, ${v.value})
    ON CONFLICT (user_id)
    DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = now()`;
  return NextResponse.json({ nickname: v.value });
}
```

Replace `web/app/api/auth/me/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ user: null });

  // 표시 이름의 출처는 여기 하나뿐이다. nickname이 null이면 프론트가 설정 모달을 띄운다.
  const [row] = await sql`SELECT nickname FROM users WHERE user_id = ${session.userId}`;
  return NextResponse.json({
    user: { userId: session.userId, nickname: row?.nickname ?? null },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- nickname-route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add Bfl_map/web/app/api/auth/nickname/route.ts Bfl_map/web/app/api/auth/me/route.ts Bfl_map/web/__tests__/nickname-route.test.ts
git commit -m "feat: add nickname endpoint and serve display name from the database"
```

---

### Task 5: 리뷰 API를 users에 연결

**Files:**
- Modify: `web/app/api/reviews/route.ts:11-14` (GET 조회), `:42-57` (POST 가드와 INSERT)
- Test: `web/__tests__/reviews.test.ts:66-105`

**Interfaces:**
- Consumes: `users` 테이블 (Task 3), `verifySessionToken` (Task 2)
- Produces: `GET /api/reviews`의 각 리뷰 항목은 이전과 같은 `{ nickname, taste, waiting, body, updated_at }` 모양을 유지한다 — 값의 출처만 조인으로 바뀐다. 닉네임 미설정 상태의 POST는 `409 { error: "닉네임을 먼저 설정해주세요." }`

- [ ] **Step 1: Write the failing test**

In `web/__tests__/reviews.test.ts`, replace the `postReview` helper (lines 66-77) and add one test. The helper's session no longer carries a nickname:

```ts
async function postReview(userId: string) {
  const { POST } = await import("@/app/api/reviews/route");
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const { NextRequest } = await import("next/server");
  const token = await createSessionToken(userId);
  const req = new NextRequest("http://localhost/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: JSON.stringify(valid),
  });
  return POST(req);
}
```

Every existing rate-limit mock now also has to answer the nickname question, since it rides in the same query. Update the four `mockResolvedValueOnce` guard rows to include `hasNickname: true`:

```ts
describe("POST /api/reviews rate limit", () => {
  it("rejects a repeat write to the same place inside the 10s cooldown", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 1, tooSoon: true, hasNickname: true }]);
    const res = await postReview("user-cooldown-blocked");
    expect(res.status).toBe(429);
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the insert round trip
  });

  it("allows a repeat write to the same place once the cooldown has passed", async () => {
    sqlMock
      .mockResolvedValueOnce([{ recent: 1, tooSoon: false, hasNickname: true }])
      .mockResolvedValueOnce([]);
    const res = await postReview("user-cooldown-passed");
    expect(res.status).toBe(201);
  });

  it("still rejects once a user has written to 5 distinct places in the last minute", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 5, tooSoon: null, hasNickname: true }]);
    const res = await postReview("user-crossplace-limit");
    expect(res.status).toBe(429);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("never blocks a first-ever review for a place (tooSoon is null)", async () => {
    sqlMock
      .mockResolvedValueOnce([{ recent: 0, tooSoon: null, hasNickname: true }])
      .mockResolvedValueOnce([]);
    const res = await postReview("user-first-review");
    expect(res.status).toBe(201);
  });
});

// 모달을 우회해 API를 직접 호출한 경우에 대한 방어
describe("POST /api/reviews nickname guard", () => {
  it("blocks a session that has not set a nickname yet", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0, tooSoon: null, hasNickname: false }]);
    const res = await postReview("user-without-nickname");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "닉네임을 먼저 설정해주세요." });
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the insert round trip
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reviews.test.ts`
Expected: FAIL — nickname guard 테스트가 409 대신 201을 받는다

- [ ] **Step 3: Write minimal implementation**

In `web/app/api/reviews/route.ts`, replace the GET query (lines 11-14) so the name comes from `users`:

```ts
  const reviews = await sql`
    SELECT u.nickname, r.taste, r.waiting, r.body, r.updated_at
    FROM reviews r JOIN users u ON u.user_id = r.user_id
    WHERE r.place_id = ${placeId}
    ORDER BY r.updated_at DESC LIMIT 50`;
```

The summary query below it is unchanged — it only aggregates ratings.

Then replace the guard query, the guard, and the INSERT (lines 42-57):

```ts
  const [{ recent, tooSoon, hasNickname }] = await sql`
    SELECT
      (SELECT count(*)::int FROM reviews
        WHERE user_id = ${user.userId} AND updated_at > now() - interval '1 minute') AS recent,
      (SELECT updated_at > now() - interval '10 seconds' FROM reviews
        WHERE user_id = ${user.userId} AND place_id = ${placeId}) AS "tooSoon",
      EXISTS (SELECT 1 FROM users WHERE user_id = ${user.userId}) AS "hasNickname"`;
  // 닉네임이 없으면 INSERT가 외래 키에서 터진다. 그 전에 읽을 수 있는 이유로 막는다.
  if (!hasNickname) {
    return NextResponse.json({ error: "닉네임을 먼저 설정해주세요." }, { status: 409 });
  }
  if (recent >= 5 || tooSoon === true) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }
  await sql`
    INSERT INTO reviews (place_id, user_id, taste, waiting, body)
    VALUES (${placeId}, ${user.userId}, ${taste}, ${waiting}, ${body})
    ON CONFLICT (place_id, user_id)
    DO UPDATE SET taste = EXCLUDED.taste, waiting = EXCLUDED.waiting,
                  body = EXCLUDED.body, updated_at = now()`;
```

Rename the local `user` binding to `session` if the type reads oddly — `verifySessionToken` now returns `{ userId }` only, so `user.nickname` must not appear anywhere in this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reviews.test.ts`
Expected: PASS (13 tests)

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add Bfl_map/web/app/api/reviews/route.ts Bfl_map/web/__tests__/reviews.test.ts
git commit -m "feat: read review author names from users and guard unset nicknames"
```

---

### Task 6: 닉네임 모달과 화면 연결

**Files:**
- Create: `web/components/NicknameModal.tsx`
- Modify: `web/app/page.tsx:12` (타입), `:20` (상태), `:37` (me 페치), `:74-102` (헤더), `:168` 부근 (모달 렌더)

**Interfaces:**
- Consumes: `PUT /api/auth/nickname` (Task 4), `suggestNickname` (Task 1)
- Produces:
  - `export type SessionUser = { userId: string; nickname: string | null }` (from `app/page.tsx`, `ReviewSection`이 이미 import 중)
  - `<NicknameModal mode="create" | "edit" initial={string} onSaved={(nickname: string) => void} onClose={() => void} />`

- [ ] **Step 1: Write the component**

Create `web/components/NicknameModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { NICKNAME_MAX_LEN } from "@/lib/nickname";

type Props = {
  mode: "create" | "edit";
  initial: string;
  onSaved: (nickname: string) => void;
  onClose: () => void;
};

export default function NicknameModal({ mode, initial, onSaved, onClose }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/auth/nickname", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "저장에 실패했어요.");
      return;
    }
    const d = await res.json();
    onSaved(d.nickname);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-xl border border-border bg-surface p-6 shadow-lg">
        <h2 className="text-lg font-bold text-text-primary">
          {mode === "create" ? "쓸 이름을 정해주세요" : "닉네임 변경"}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          리뷰에 이 이름으로 표시돼요. 카카오·구글 이름은 쓰지 않아요.
        </p>
        <input
          className="mt-4 h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          value={value}
          maxLength={NICKNAME_MAX_LEN}
          onChange={e => setValue(e.target.value)}
          aria-label="닉네임"
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button
            className="grid h-11 place-items-center rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={save}
          >
            {busy ? "저장 중…" : "확인"}
          </button>
          {mode === "edit" && (
            <button
              className="grid h-11 place-items-center rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
              onClick={onClose}
            >
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

`mode="create"`에는 취소 버튼도 배경 클릭 닫기도 없다. 그게 "닫을 수 없는 모달"의 구현이다.

- [ ] **Step 2: Wire it into the page**

In `web/app/page.tsx`:

Change the exported type (line 12):

```ts
export type SessionUser = { userId: string; nickname: string | null };
```

Add state next to the others (near line 20):

```ts
  const [editingNickname, setEditingNickname] = useState(false);
```

Add the import alongside the other component imports:

```ts
import NicknameModal from "@/components/NicknameModal";
import { suggestNickname } from "@/lib/nickname";
```

Replace the logged-in header branch (lines 74-83) so the name is a button and never renders `null`:

```tsx
        {user?.nickname ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              className="grid h-11 place-items-center rounded-lg px-2 text-text-primary md:h-9"
              onClick={() => setEditingNickname(true)}
            >
              {user.nickname}님
            </button>
            <button
              className="grid h-11 place-items-center rounded-lg border border-border px-3 text-text-primary md:h-9"
              onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null))}
            >
              로그아웃
            </button>
          </div>
        ) : user ? null : (
```

The final `) : user ? null : (` keeps the two login buttons for anonymous visitors while showing nothing in the header for a logged-in user who has not picked a name yet — the modal owns that moment.

Render the modal just before `<EntryNotice />` (line 168):

```tsx
        {user && user.nickname === null && (
          <NicknameModal
            mode="create"
            initial={suggestNickname()}
            onSaved={n => setUser({ ...user, nickname: n })}
            onClose={() => {}}
          />
        )}
        {user?.nickname && editingNickname && (
          <NicknameModal
            mode="edit"
            initial={user.nickname}
            onSaved={n => { setUser({ ...user, nickname: n }); setEditingNickname(false); }}
            onClose={() => setEditingNickname(false)}
          />
        )}
```

Both go **inside** the `<div className="relative flex-1">` that already wraps the map, so `absolute inset-0` covers the map area.

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: 에러 없음

Run: `npm run lint`
Expected: 에러 없음

Run: `npm run build`
Expected: 성공

- [ ] **Step 4: Verify in the browser**

`.claude/launch.json`의 dev 서버를 preview_start로 띄우고 `http://localhost:3000` 을 연다. 확인 항목:

1. 비로그인 상태 — 헤더에 로그인 버튼 두 개, 모달 없음
2. 카카오 로그인 → **본명이 어디에도 뜨지 않고** 닉네임 모달이 뜬다. 입력칸에 `점심러####` 가 채워져 있다
3. `점심 러`(공백)를 넣고 [확인] → "한글, 영문, 숫자, 밑줄만 쓸 수 있어요."
4. 그대로 [확인] → 모달이 닫히고 헤더에 `점심러####님`
5. 헤더의 닉네임 클릭 → 변경 모달, [취소]로 닫힘
6. 가게 선택 → 리뷰 작성 → 방금 정한 닉네임으로 표시됨
7. 닉네임을 바꾸고 같은 가게를 다시 열면 **과거 리뷰의 이름도 바뀌어 있다**

read_console_messages로 에러가 없는지도 확인한다.

- [ ] **Step 5: Commit**

```bash
git add Bfl_map/web/components/NicknameModal.tsx Bfl_map/web/app/page.tsx
git commit -m "feat: add nickname modal and show display names in the header"
```

---

### Task 7: 배포와 실환경 검증

**Files:**
- Modify: `web/README.md` (환경/마이그레이션 절차에 users 테이블 추가)

- [ ] **Step 1: Confirm the migration already ran**

Task 3 Step 4의 두 쿼리를 다시 돌려 프로덕션 DB가 마이그레이션된 상태인지 확인한다. **마이그레이션이 배포보다 먼저여야 한다.**

- [ ] **Step 2: Document it**

`web/README.md`의 DB 설정 항목에, 새 데이터베이스는 `schema.sql`로 만들고 기존 데이터베이스는 `migrations/2026-08-04-users-nickname.sql`을 한 번 실행한다는 문장을 추가한다.

- [ ] **Step 3: Deploy**

`feature/bfl-map-nickname`을 `main`에 병합하고 Vercel 배포를 확인한다. 병합 방식은 사용자에게 확인받는다.

- [ ] **Step 4: Verify on production**

```bash
curl -sS "https://bfl-map-pixl.vercel.app/api/auth/me"
```
Expected: `{"user":null}` (비로그인)

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PUT "https://bfl-map-pixl.vercel.app/api/auth/nickname" -H "Content-Type: application/json" -d '{"nickname":"점심러1234"}'
```
Expected: `401`

브라우저에서 Task 6 Step 4의 7개 항목을 프로덕션 도메인으로 다시 확인한다.

- [ ] **Step 5: Commit**

```bash
git add Bfl_map/web/README.md
git commit -m "docs: note the users table migration"
```

---

## Self-Review

**Spec coverage**

| 스펙 항목 | 구현 태스크 |
|---|---|
| 첫 로그인 시 닉네임 설정 | Task 6 (모달), Task 4 (API) |
| 이름 변경이 과거 리뷰에 소급 | Task 3 (조인 구조), Task 5 (GET 조인) |
| 프로바이더 이름 미저장 | Task 2 |
| users 테이블·백필·FK | Task 3 |
| 세션 JWT는 sub만 / 구 토큰 호환 | Task 2 |
| /api/auth/me 3가지 응답 | Task 4 |
| 2~12자·문자셋·욕설·중복 허용 | Task 1 |
| 자동 제안값 | Task 1, Task 6 |
| PUT /api/auth/nickname 401/400/200 | Task 4 |
| 리뷰 409 가드 | Task 5 |
| 테스트 3종 | Task 1, 2, 4, 5 |

빠진 항목 없음.

**Placeholder scan** — "적절히", "TBD", "필요시" 없음. 모든 코드 단계에 실제 코드가 있다.

**Type consistency** — `Session = { userId }`(Task 2)를 Task 4·5가 그대로 쓴다. `SessionUser = { userId, nickname: string | null }`(Task 6)은 `ReviewSection`이 이미 `@/app/page`에서 import하는 이름 그대로다. `validateNickname`/`suggestNickname`/`NICKNAME_MAX_LEN`(Task 1)의 이름이 Task 4·6에서 동일하다. `hasNickname` 키가 Task 5의 쿼리·가드·테스트에서 일치한다.
