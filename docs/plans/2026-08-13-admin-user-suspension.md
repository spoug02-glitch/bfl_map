# 어드민: 운영자 계정 + 사용자 정지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자 계정 체계(최고관리자/운영자 2단계)를 새로 만들고, 로그인한 운영자가 유저를 검색해 1시간/3시간/1일/3일/7일/영구 정지를 걸고 풀 수 있는 `/admin` 페이지를 만든다.

**Architecture:** 운영자 인증은 기존 유저 세션(`bfl_session`)과 완전히 분리된 두 번째 JWT 쿠키(`bfl_admin_session`)로 돈다. 정지 상태는 `users.suspended_until` 한 컬럼으로 판정하고(`NULL`=정상, 미래 시각=정지, 영구 정지는 고정 상수), `user_suspensions`가 누가·언제·왜 걸고 풀었는지 이력을 별도로 남긴다. 정지는 글쓰기(리뷰 작성/수정, 닉네임 변경) 세 지점에서만 막고, 리뷰 삭제·지도 열람은 그대로 둔다. 서버 차단과 별개로 클라이언트도 `/api/auth/me`가 내려주는 `suspendedUntil`을 보고 작성 폼을 미리 잠그고 안내 문구를 보여준다.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript, Neon Postgres(`@neondatabase/serverless`, HTTP `sql.transaction()`), jose(JWT), Node 내장 `crypto.scrypt`, vitest, Tailwind

**스펙:** `Bfl_map/docs/specs/2026-08-13-admin-user-suspension-design.md`

**실행 순서: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16.**
Task 12(정지 집행)가 기존 리뷰 수정·닉네임 라우트의 sql 호출 순서를 바꾸므로, 그 라우트를 이미 테스트하는 파일(`review-edit.test.ts`, `nickname-route.test.ts`)의 mock을 Task 12 안에서 같이 고친다. 순수 로직(2~5)을 라우트(7~12)보다 먼저 끝내 둬야 라우트 작성 때 바로 가져다 쓸 수 있다.

## Global Constraints

- 운영자 세션과 유저 세션은 **쿠키·시크릿 모두 별도**다(`bfl_admin_session`/`ADMIN_SESSION_SECRET` vs `bfl_session`/`SESSION_SECRET`). 어느 쪽 lib 파일도 서로 import하지 않는다.
- 비밀번호 해시는 **새 패키지 없이 Node 내장 `crypto.scrypt`**. 저장 포맷은 `scrypt:<N>:<salt_hex>:<hash_hex>`.
- 정지 기간 라벨은 `"1h" | "3h" | "1d" | "3d" | "7d" | "permanent"` 다섯 + 하나뿐이다. 다른 문자열은 전부 400.
- 영구 정지는 코드 상수 `PERMANENT_SUSPENSION_UNTIL = new Date("9999-12-31T23:59:59Z")`를 그대로 저장한다. 별도 boolean 컬럼을 두지 않는다.
- 운영자 아이디는 **생성·조회·로그인 모두 `trim()` + 소문자 비교**로 통일한다. 유니크 인덱스도 `lower(trim(username))` 기준.
- `/api/admin/users` 검색은 **`limit`(기본 20, 최대 100)·`offset`을 항상 강제**한다. 무제한 스캔을 허용하지 않는다.
- 정지 걸기/해제의 두 테이블 쓰기(`users` + `user_suspensions`)는 **`sql.transaction([...])`로 묶는다.** 하나만 성공하는 상태를 만들지 않는다.
- 정지는 **리뷰 작성(POST)·리뷰 수정(PATCH)·닉네임 변경(PUT)만** 막는다. 리뷰 삭제·저장·지도 열람·로그인은 그대로 둔다.
- 정지 안내 문구는 **새로 만들지 않는다.** `feature/bfl-map-nickname` 브랜치에 footer/약관 작업(`72e2273a`)이 이미 `web/lib/legal.ts`에 `suspensionNotice(until: string | null)`(제한 문구)와 `CONTACT_LINE`(문의 안내, `CREDIT.email` 사용)을 만들어 뒀다. `lib/suspension.ts`는 **기간 계산·검증 같은 순수 로직만** 담당하고 문구를 만드는 헬퍼(`suspensionMessage`류)는 어떤 이름으로도 추가하지 않는다. 호출부(라우트·컴포넌트)가 `isPermanentSuspension(until) ? null : kstDateTime(until)`로 문자열을 만들어 `suspensionNotice()`에 직접 넘기고, 문의 안내가 필요한 화면(프론트 배너)에서는 `CONTACT_LINE`을 별도 줄로 덧붙인다. API 403 응답 본문은 `suspensionNotice(...)` 결과만 담고 `CONTACT_LINE`은 붙이지 않는다(문의는 UI에서만 보조 정보로).
- 최고관리자는 **자기 자신과 마지막 남은 최고관리자를 비활성화할 수 없다.**
- 모든 API 에러 응답은 `{ "error": "<한국어 문장>" }` 모양으로 통일한다(기존 라우트와 동일 관례).
- 작업 디렉터리는 전부 `Bfl_map/web/`. 명령은 그 안에서 실행한다.
- 이 저장소는 Windows다. 한글이 든 파일은 Read/Edit/Write 도구로만 다룬다(PowerShell 텍스트 파이프라인 금지).

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `web/migrations/2026-08-13-admin-users.sql` | `admin_users` 테이블 |
| `web/migrations/2026-08-13-user-suspensions.sql` | `users.suspended_until` + `user_suspensions` 테이블 |
| `web/lib/admin-auth.ts` | scrypt 해시/검증, 아이디 정규화. DB 없음 |
| `web/__tests__/admin-auth.test.ts` | 위 모듈 테스트 |
| `web/lib/admin-session.ts` | 운영자 세션 JWT + `requireAdmin()` 가드 |
| `web/__tests__/admin-session.test.ts` | 위 모듈 테스트 |
| `web/lib/suspension.ts` | 순수 로직: 기간→만료시각 계산, 유효성 검사만(안내 문구는 기존 `lib/legal.ts` 재사용). DB 없음 — 클라이언트 컴포넌트도 import 가능 |
| `web/__tests__/suspension.test.ts` | 위 모듈 테스트 |
| `web/lib/suspension-server.ts` | `isSuspended(userId)` — DB 조회 |
| `web/__tests__/suspension-server.test.ts` | 위 모듈 테스트 |
| `web/scripts/seed-admin.mjs` | 최초 super_admin 계정 생성 스크립트 |
| `web/app/api/admin/auth/login/route.ts` | 운영자 로그인, 실패 잠금 |
| `web/app/api/admin/auth/logout/route.ts` | 쿠키 삭제 |
| `web/__tests__/admin-login-route.test.ts` | 위 두 라우트 테스트 |
| `web/app/api/admin/stats/route.ts` | DAU/WAU/MAU (기존 `/api/stats` 대체) |
| `web/__tests__/admin-stats-route.test.ts` | 위 라우트 테스트 |
| `web/app/api/admin/users/route.ts` | 유저 검색(페이지네이션 필수) |
| `web/app/api/admin/users/[userId]/route.ts` | 유저 상세(정지 상태·최근 리뷰·이력) |
| `web/__tests__/admin-users-route.test.ts` | 위 두 라우트 테스트 |
| `web/app/api/admin/users/[userId]/suspend/route.ts` | 정지 걸기(트랜잭션) |
| `web/app/api/admin/users/[userId]/unsuspend/route.ts` | 정지 해제(트랜잭션) |
| `web/__tests__/admin-suspend-route.test.ts` | 위 두 라우트 테스트 |
| `web/app/api/admin/operators/route.ts` | 운영자 목록/생성 (super_admin 전용) |
| `web/app/api/admin/operators/[id]/deactivate/route.ts` | 운영자 비활성화 + 안전장치 |
| `web/__tests__/admin-operators-route.test.ts` | 위 세 라우트 테스트 |
| `web/__tests__/suspension-enforcement.test.ts` | 정지 중 리뷰 작성/수정/닉네임 변경 403, 삭제는 통과 |
| `web/components/admin/AdminLoginForm.tsx` | 로그인 폼 |
| `web/components/admin/AdminDashboard.tsx` | 검색·상세·정지/해제 UI + DAU/WAU/MAU |
| `web/components/admin/OperatorsPage.tsx` | 운영자 계정 관리 UI |
| `web/app/admin/login/page.tsx` | 로그인 페이지(서버, 이미 로그인 상태면 `/admin`으로) |
| `web/app/admin/page.tsx` | 대시보드 페이지(서버, 인증 가드) |
| `web/app/admin/operators/page.tsx` | 운영자 관리 페이지(서버, super_admin 가드) |

**수정**

| 파일 | 변경 |
|---|---|
| `web/schema.sql` | `admin_users`, `user_suspensions` 테이블 + `users.suspended_until` 컬럼 반영 |
| `web/lib/kst.ts` | `kstDateTime(d: Date): string` 추가 (시:분까지) |
| `web/lib/constants.ts` | `SessionUser`에 `suspendedUntil: string \| null` 추가 |
| `web/app/api/auth/me/route.ts` | 응답에 `suspendedUntil` 포함 |
| `web/app/api/reviews/route.ts` | POST에 정지 체크 삽입 |
| `web/app/api/reviews/[id]/route.ts` | PATCH에 정지 체크 삽입(DELETE는 그대로) |
| `web/app/api/auth/nickname/route.ts` | PUT에 정지 체크 삽입 |
| `web/__tests__/review-edit.test.ts` | PATCH 성공 경로 mock에 정지 체크 호출 1개 추가 |
| `web/__tests__/nickname-route.test.ts` | 쓰기 경로 mock에 정지 체크 호출 1개씩 추가, 호출 횟수 재조정 |
| `web/components/ReviewSection.tsx` | 정지 중 배너 + `<fieldset disabled>`로 작성 폼 잠금, 내 리뷰 "수정" 버튼 숨김(삭제는 유지) |
| `web/components/NicknameModal.tsx` | `suspendedUntil` prop, edit 모드에서 배너 + 입력/제출 잠금 |
| `web/components/MapApp.tsx` | edit 모드 `NicknameModal`에 `suspendedUntil={user.suspendedUntil}` 전달 |
| `web/app/api/stats/route.ts` | **삭제** — `/api/admin/stats`로 대체 |
| `web/.env.example` | `ADMIN_USER_ID` 제거, `ADMIN_SESSION_SECRET`/`SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` 추가 |

---

### Task 1: 스키마 마이그레이션

**Files:**
- Create: `web/migrations/2026-08-13-admin-users.sql`
- Create: `web/migrations/2026-08-13-user-suspensions.sql`
- Modify: `web/schema.sql`

**Interfaces:**
- Produces: `admin_users(id, username, password_hash, role, is_active, failed_attempts, locked_until, created_at, created_by)`, `users.suspended_until`, `user_suspensions(id, user_id, admin_id, reason, duration_label, suspended_until, created_at, lifted_at, lifted_by)`

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `web/migrations/2026-08-13-admin-users.sql`:

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL CHECK (length(trim(username)) >= 3),
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('super_admin', 'operator')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      INTEGER REFERENCES admin_users (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_key
  ON admin_users (lower(trim(username)));
```

Create `web/migrations/2026-08-13-user-suspensions.sql`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_suspensions (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users (user_id),
  admin_id        INTEGER NOT NULL REFERENCES admin_users (id),
  reason          TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  duration_label  TEXT NOT NULL CHECK (
    duration_label IN ('1h', '3h', '1d', '3d', '7d', 'permanent')
  ),
  suspended_until TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifted_at       TIMESTAMPTZ,
  lifted_by       INTEGER REFERENCES admin_users (id)
);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user
  ON user_suspensions (user_id, created_at DESC);
```

- [ ] **Step 2: `schema.sql`에 동일 내용 반영**

`web/schema.sql`의 `users` 테이블 정의 바로 아래(리뷰 테이블 앞)에 위 두 마이그레이션의 `CREATE TABLE`/`ALTER TABLE` 문을 그대로 추가한다. `users` 테이블 정의에 `suspended_until TIMESTAMPTZ` 컬럼을 넣고, `admin_users`·`user_suspensions` 테이블 전문을 이어 붙인다. ([[bfl-map-project]]가 지적한 "마이그레이션만 고치면 새 DB에서 조용히 깨진다" 함정 — 두 파일을 항상 같이 고친다.)

- [ ] **Step 3: 로컬 DB에 적용해 확인**

Run: `cd Bfl_map/web && node -e "require('dotenv').config({path:'.env.local'}); const {neon}=require('@neondatabase/serverless'); const sql=neon(process.env.DATABASE_URL); (async()=>{ const fs=require('fs'); const ddl=fs.readFileSync('migrations/2026-08-13-admin-users.sql','utf-8'); for (const s of ddl.split(';').map(x=>x.trim()).filter(Boolean)) await sql.query(s); const ddl2=fs.readFileSync('migrations/2026-08-13-user-suspensions.sql','utf-8'); for (const s of ddl2.split(';').map(x=>x.trim()).filter(Boolean)) await sql.query(s); console.log('ok'); })()"`
Expected: `ok` 출력, 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add web/migrations/2026-08-13-admin-users.sql web/migrations/2026-08-13-user-suspensions.sql web/schema.sql
git commit -m "feat(bfl-map): add admin_users and user_suspensions schema"
```

---

### Task 2: 비밀번호 해시 모듈

**Files:**
- Create: `web/lib/admin-auth.ts`
- Test: `web/__tests__/admin-auth.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(password: string): Promise<string>`
  - `verifyPassword(password: string, stored: string): Promise<boolean>`
  - `normalizeUsername(raw: string): string`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/admin-auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, normalizeUsername, verifyPassword } from "@/lib/admin-auth";

describe("hashPassword / verifyPassword", () => {
  it("produces the versioned scrypt format", async () => {
    const stored = await hashPassword("hunter2-but-longer");
    expect(stored).toMatch(/^scrypt:\d+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("verifies the correct password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false);
  });

  it("rejects a malformed stored value instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt:10:x:y")).resolves.toBe(false);
  });

  it("produces a different salt each time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Ops_Lead  ")).toBe("ops_lead");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-auth.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin-auth"`

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/admin-auth.ts`:

```ts
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options?: { N?: number },
) => Promise<Buffer>;

/** Node의 scrypt 기본 비용 파라미터(N=16384, r=8, p=1)를 그대로 쓴다. 나중에
 * 올리더라도 해시 문자열 안의 N만 보고 검증하므로 기존 비밀번호가 깨지지 않는다. */
const SCRYPT_N = 16384;
const KEY_LEN = 64;

/** Format: "scrypt:<N>:<salt_hex>:<hash_hex>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `scrypt:${SCRYPT_N}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const [, nRaw, saltHex, hashHex] = parts;
  const n = Number(nRaw);
  if (!Number.isInteger(n) || n <= 0) return false;
  if (!/^[0-9a-f]+$/.test(saltHex) || !/^[0-9a-f]+$/.test(hashHex)) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await scrypt(password, salt, expected.length, { N: n });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** 아이디는 가입·로그인 모두 이 기준으로 비교한다. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-auth.test.ts`
Expected: PASS (5개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add web/lib/admin-auth.ts web/__tests__/admin-auth.test.ts
git commit -m "feat(bfl-map): add scrypt password hashing for admin accounts"
```

---

### Task 3: 운영자 세션 모듈

**Files:**
- Create: `web/lib/admin-session.ts`
- Test: `web/__tests__/admin-session.test.ts`

**Interfaces:**
- Consumes: none (jose만 사용, `lib/session.ts`는 참고하되 import하지 않는다)
- Produces:
  - `type AdminRole = "super_admin" | "operator"`
  - `type AdminSession = { adminId: number; role: AdminRole }`
  - `ADMIN_SESSION_COOKIE = "bfl_admin_session"`
  - `adminSessionCookieOptions`
  - `createAdminSessionToken(adminId: number, role: AdminRole): Promise<string>`
  - `verifyAdminSessionToken(token: string): Promise<AdminSession | null>`
  - `requireAdmin(req: NextRequest, opts?: { requireRole?: "super_admin" }): Promise<{ ok: true; session: AdminSession } | { ok: false; response: NextResponse }>`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/admin-session.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

describe("admin session tokens", () => {
  it("round-trips adminId and role", async () => {
    const { createAdminSessionToken, verifyAdminSessionToken } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(7, "operator");
    await expect(verifyAdminSessionToken(token)).resolves.toEqual({ adminId: 7, role: "operator" });
  });

  it("rejects a garbage token", async () => {
    const { verifyAdminSessionToken } = await import("@/lib/admin-session");
    await expect(verifyAdminSessionToken("not-a-jwt")).resolves.toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const mod1 = await import("@/lib/admin-session");
    const token = await mod1.createAdminSessionToken(1, "super_admin");
    process.env.ADMIN_SESSION_SECRET = "a-completely-different-secret-value!!";
    // 모듈을 다시 불러 새 시크릿을 읽게 한다 (secretKey()는 매 호출 evaluate).
    const mod2 = await import("@/lib/admin-session");
    await expect(mod2.verifyAdminSessionToken(token)).resolves.toBeNull();
    process.env.ADMIN_SESSION_SECRET = "test-admin-secret-at-least-32-chars!!";
  });
});

describe("requireAdmin", () => {
  async function reqWithCookie(token?: string) {
    const { NextRequest } = await import("next/server");
    const headers: Record<string, string> = {};
    if (token) {
      const { ADMIN_SESSION_COOKIE } = await import("@/lib/admin-session");
      headers.cookie = `${ADMIN_SESSION_COOKIE}=${token}`;
    }
    return new NextRequest("http://localhost/api/admin/users", { headers });
  }

  it("returns 401 when there's no session", async () => {
    const { requireAdmin } = await import("@/lib/admin-session");
    const ctx = await requireAdmin(await reqWithCookie());
    if (ctx.ok) throw new Error("expected ok:false");
    expect(ctx.response.status).toBe(401);
  });

  it("passes for any admin when no role is required", async () => {
    const { createAdminSessionToken, requireAdmin } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(3, "operator");
    const ctx = await requireAdmin(await reqWithCookie(token));
    expect(ctx).toEqual({ ok: true, session: { adminId: 3, role: "operator" } });
  });

  it("returns 403 when an operator hits a super_admin-only route", async () => {
    const { createAdminSessionToken, requireAdmin } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(3, "operator");
    const ctx = await requireAdmin(await reqWithCookie(token), { requireRole: "super_admin" });
    if (ctx.ok) throw new Error("expected ok:false");
    expect(ctx.response.status).toBe(403);
  });

  it("passes a super_admin through a super_admin-only route", async () => {
    const { createAdminSessionToken, requireAdmin } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(9, "super_admin");
    const ctx = await requireAdmin(await reqWithCookie(token), { requireRole: "super_admin" });
    expect(ctx).toEqual({ ok: true, session: { adminId: 9, role: "super_admin" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-session.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/admin-session"`

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/admin-session.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

export type AdminRole = "super_admin" | "operator";
export type AdminSession = { adminId: number; role: AdminRole };

export const ADMIN_SESSION_COOKIE = "bfl_admin_session";
const TWELVE_HOURS_SEC = 60 * 60 * 12;

export const adminSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TWELVE_HOURS_SEC,
};

function secretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be set (>=32 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminSessionToken(adminId: number, role: AdminRole): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(adminId))
    .setIssuedAt()
    .setExpirationTime(`${TWELVE_HOURS_SEC}s`)
    .sign(secretKey());
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    const adminId = Number(payload.sub);
    if (!Number.isInteger(adminId)) return null;
    if (payload.role !== "super_admin" && payload.role !== "operator") return null;
    return { adminId, role: payload.role };
  } catch {
    return null;
  }
}

type AdminContext =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

/** `/api/admin/*`의 auth/login을 뺀 모든 라우트가 맨 앞에서 부른다. */
export async function requireAdmin(
  req: NextRequest,
  opts: { requireRole?: "super_admin" } = {},
): Promise<AdminContext> {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  if (opts.requireRole === "super_admin" && session.role !== "super_admin") {
    return { ok: false, response: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true, session };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-session.test.ts`
Expected: PASS (7개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add web/lib/admin-session.ts web/__tests__/admin-session.test.ts
git commit -m "feat(bfl-map): add separate admin session cookie and requireAdmin guard"
```

---

### Task 4: 정지 순수 로직 모듈

**Files:**
- Modify: `web/lib/kst.ts`
- Create: `web/lib/suspension.ts`
- Test: `web/__tests__/suspension.test.ts`

**Interfaces:**
- Consumes: `kstDateTime(d: Date): string` (본 태스크에서 `kst.ts`에 추가)
- Produces:
  - `type DurationLabel = "1h" | "3h" | "1d" | "3d" | "7d" | "permanent"`
  - `PERMANENT_SUSPENSION_UNTIL: Date`
  - `durationToSuspendedUntil(label: DurationLabel, now?: Date): Date`
  - `isValidDurationLabel(v: unknown): v is DurationLabel`
  - `isPermanentSuspension(until: Date): boolean`
  - `isSuspensionActive(until: Date | null): boolean`

이 파일은 **순수 기간 계산/검증만** 맡는다. 사용자에게 보여줄 문구는 만들지 않는다 — `feature/bfl-map-nickname`의 footer/약관 작업(`72e2273a`)이 이미 `web/lib/legal.ts`에 `suspensionNotice(until: string | null): string`과 `CONTACT_LINE`을 만들어 뒀고, 이 계획은 그걸 그대로 재사용한다. 호출부는 `suspensionNotice(isPermanentSuspension(until) ? null : kstDateTime(until))` 형태로 직접 조합한다.

- [ ] **Step 1: `kst.ts`에 시:분 포맷 추가**

`web/lib/kst.ts` 끝에 추가:

```ts
/** "2026년 8월 14일 15:30" — 정지 만료 안내처럼 시:분까지 보여줘야 할 때 쓴다. */
export function kstDateTime(d: Date): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}년 ${m}월 ${day}일 ${hh}:${mm}`;
}
```

- [ ] **Step 2: Write the failing test**

Create `web/__tests__/suspension.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PERMANENT_SUSPENSION_UNTIL,
  durationToSuspendedUntil,
  isPermanentSuspension,
  isSuspensionActive,
  isValidDurationLabel,
} from "@/lib/suspension";

const NOW = new Date("2026-08-13T00:00:00Z");

describe("durationToSuspendedUntil", () => {
  it("adds the right offset for each timed label", () => {
    expect(durationToSuspendedUntil("1h", NOW)).toEqual(new Date("2026-08-13T01:00:00Z"));
    expect(durationToSuspendedUntil("3h", NOW)).toEqual(new Date("2026-08-13T03:00:00Z"));
    expect(durationToSuspendedUntil("1d", NOW)).toEqual(new Date("2026-08-14T00:00:00Z"));
    expect(durationToSuspendedUntil("3d", NOW)).toEqual(new Date("2026-08-16T00:00:00Z"));
    expect(durationToSuspendedUntil("7d", NOW)).toEqual(new Date("2026-08-20T00:00:00Z"));
  });

  it("returns the permanent constant for 'permanent'", () => {
    expect(durationToSuspendedUntil("permanent", NOW)).toBe(PERMANENT_SUSPENSION_UNTIL);
  });
});

describe("isValidDurationLabel", () => {
  it("accepts the six known labels", () => {
    for (const l of ["1h", "3h", "1d", "3d", "7d", "permanent"]) {
      expect(isValidDurationLabel(l)).toBe(true);
    }
  });
  it("rejects anything else", () => {
    expect(isValidDurationLabel("2h")).toBe(false);
    expect(isValidDurationLabel(undefined)).toBe(false);
    expect(isValidDurationLabel(1)).toBe(false);
  });
});

describe("isPermanentSuspension / isSuspensionActive", () => {
  it("recognizes the permanent constant and nothing else", () => {
    expect(isPermanentSuspension(PERMANENT_SUSPENSION_UNTIL)).toBe(true);
    expect(isPermanentSuspension(new Date("9999-12-31T23:59:58Z"))).toBe(false);
  });

  it("treats a future date as active and a past date as inactive", () => {
    expect(isSuspensionActive(new Date(Date.now() + 60_000))).toBe(true);
    expect(isSuspensionActive(new Date(Date.now() - 60_000))).toBe(false);
  });

  it("treats null as inactive", () => {
    expect(isSuspensionActive(null)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- suspension.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/suspension"`

- [ ] **Step 4: Write minimal implementation**

Create `web/lib/suspension.ts`:

```ts
export type DurationLabel = "1h" | "3h" | "1d" | "3d" | "7d" | "permanent";

/** 영구 정지는 이 값을 그대로 저장한다 — `suspended_until > now()` 하나로 정지
 * 여부를 판정하기 위해 별도 boolean 컬럼을 두지 않는다. */
export const PERMANENT_SUSPENSION_UNTIL = new Date("9999-12-31T23:59:59Z");

const DURATION_MS: Record<Exclude<DurationLabel, "permanent">, number> = {
  "1h": 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export function durationToSuspendedUntil(label: DurationLabel, now: Date = new Date()): Date {
  if (label === "permanent") return PERMANENT_SUSPENSION_UNTIL;
  return new Date(now.getTime() + DURATION_MS[label]);
}

export function isValidDurationLabel(v: unknown): v is DurationLabel {
  return v === "1h" || v === "3h" || v === "1d" || v === "3d" || v === "7d" || v === "permanent";
}

export function isPermanentSuspension(until: Date): boolean {
  return until.getTime() === PERMANENT_SUSPENSION_UNTIL.getTime();
}

export function isSuspensionActive(until: Date | null): boolean {
  return until !== null && until.getTime() > Date.now();
}
```

문구를 만드는 함수는 이 파일에 두지 않는다 — 호출부가 `suspensionNotice(isPermanentSuspension(until) ? null : kstDateTime(until))`(`@/lib/legal`, `@/lib/kst`)를 직접 조합해서 쓴다. `kstDateTime`은 Task 12/13의 호출부에서 import한다.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- suspension.test.ts`
Expected: PASS (7개 테스트 통과)

- [ ] **Step 6: Commit**

```bash
git add web/lib/kst.ts web/lib/suspension.ts web/__tests__/suspension.test.ts
git commit -m "feat(bfl-map): add pure suspension duration/message logic"
```

---

### Task 5: 정지 여부 DB 조회

**Files:**
- Create: `web/lib/suspension-server.ts`
- Test: `web/__tests__/suspension-server.test.ts`

**Interfaces:**
- Consumes: `sql` from `@/lib/db`
- Produces:
  - `type SuspensionStatus = { suspended: boolean; until: Date | null }`
  - `isSuspended(userId: string): Promise<SuspensionStatus>`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/suspension-server.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeEach(() => {
  sqlMock.mockReset();
});

describe("isSuspended", () => {
  it("reports not suspended when suspended_until is null", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: null }]);
    const { isSuspended } = await import("@/lib/suspension-server");
    await expect(isSuspended("kakao:1")).resolves.toEqual({ suspended: false, until: null });
  });

  it("reports not suspended when suspended_until is in the past", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: new Date(Date.now() - 60_000).toISOString() }]);
    const { isSuspended } = await import("@/lib/suspension-server");
    await expect(isSuspended("kakao:1")).resolves.toEqual({ suspended: false, until: null });
  });

  it("reports suspended with the expiry when suspended_until is in the future", async () => {
    const until = new Date(Date.now() + 60_000);
    sqlMock.mockResolvedValueOnce([{ suspended_until: until.toISOString() }]);
    const { isSuspended } = await import("@/lib/suspension-server");
    const result = await isSuspended("kakao:1");
    expect(result.suspended).toBe(true);
    expect(result.until?.getTime()).toBe(until.getTime());
  });

  it("reports not suspended when the user row doesn't exist", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const { isSuspended } = await import("@/lib/suspension-server");
    await expect(isSuspended("kakao:ghost")).resolves.toEqual({ suspended: false, until: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- suspension-server.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/suspension-server"`

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/suspension-server.ts`:

```ts
import { sql } from "@/lib/db";

export type SuspensionStatus = { suspended: boolean; until: Date | null };

/** 글쓰기 라우트가 필요로 하는 전부. */
export async function isSuspended(userId: string): Promise<SuspensionStatus> {
  const [row] = await sql`SELECT suspended_until FROM users WHERE user_id = ${userId}`;
  const until = row?.suspended_until ? new Date(row.suspended_until) : null;
  if (!until || until.getTime() <= Date.now()) return { suspended: false, until: null };
  return { suspended: true, until };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- suspension-server.test.ts`
Expected: PASS (4개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add web/lib/suspension-server.ts web/__tests__/suspension-server.test.ts
git commit -m "feat(bfl-map): add isSuspended DB check"
```

---

### Task 6: 최초 최고관리자 시드 스크립트

**Files:**
- Create: `web/scripts/seed-admin.mjs`
- Modify: `web/.env.example`

**Interfaces:**
- Consumes: `DATABASE_URL`, `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` 환경변수
- Produces: `admin_users`에 `role='super_admin'` 행 1개

- [ ] **Step 1: 스크립트 작성**

Create `web/scripts/seed-admin.mjs`:

```js
import { neon } from "@neondatabase/serverless";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { config } from "dotenv";

config({ path: ".env.local" });

const scrypt = promisify(scryptCallback);
const SCRYPT_N = 16384;
const KEY_LEN = 64;

// lib/admin-auth.ts의 hashPassword와 같은 포맷을 낸다. 이 스크립트는 Next.js
// 빌드를 거치지 않는 순수 Node ESM이라 TS 파일을 직접 import할 수 없어 복제한다.
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `scrypt:${SCRYPT_N}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

const username = process.env.SEED_ADMIN_USERNAME;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!username || !password) {
  console.error("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD must be set.");
  process.exit(1);
}
if (username.trim().length < 3) {
  console.error("SEED_ADMIN_USERNAME must be at least 3 characters.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const [existing] = await sql`
  SELECT id FROM admin_users WHERE lower(trim(username)) = lower(trim(${username}))`;
if (existing) {
  console.error(`admin_users row already exists for "${username}" (id=${existing.id}).`);
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const [row] = await sql`
  INSERT INTO admin_users (username, password_hash, role)
  VALUES (${username}, ${passwordHash}, 'super_admin')
  RETURNING id`;
console.log(`super_admin created: id=${row.id}, username=${username}`);
```

- [ ] **Step 2: `.env.example` 갱신**

`web/.env.example`에서 다음 세 줄:
```
# DAU/MAU stats. Namespaced id of the admin, e.g. kakao:5678 (get it from /api/auth/me).
# /api/stats returns 404 while this is empty.
ADMIN_USER_ID=
```
을 다음으로 바꾼다:
```
# 운영자(어드민) 세션. openssl rand -hex 32 로 생성 — SESSION_SECRET과 다른 값이어야 한다.
ADMIN_SESSION_SECRET=generate-with: openssl rand -hex 32
# 최초 super_admin 계정 생성용 (scripts/seed-admin.mjs 실행 시에만 필요, 평소엔 비워둠)
SEED_ADMIN_USERNAME=
SEED_ADMIN_PASSWORD=
```

- [ ] **Step 3: 로컬에서 1회 실행해 확인**

Run: `cd Bfl_map/web && SEED_ADMIN_USERNAME=test-owner SEED_ADMIN_PASSWORD=test-password-123 node scripts/seed-admin.mjs`
Expected: `super_admin created: id=1, username=test-owner` 출력. (검증 후 로컬 DB에서 해당 행은 지워도 된다 — 운영 계정은 배포 뒤 실제 값으로 별도 실행한다.)

- [ ] **Step 4: Commit**

```bash
git add web/scripts/seed-admin.mjs web/.env.example
git commit -m "feat(bfl-map): add super_admin seed script"
```

---

### Task 7: 운영자 로그인/로그아웃 라우트

**Files:**
- Create: `web/app/api/admin/auth/login/route.ts`
- Create: `web/app/api/admin/auth/logout/route.ts`
- Test: `web/__tests__/admin-login-route.test.ts`

**Interfaces:**
- Consumes: `normalizeUsername`, `verifyPassword` (`@/lib/admin-auth`), `ADMIN_SESSION_COOKIE`, `adminSessionCookieOptions`, `createAdminSessionToken` (`@/lib/admin-session`), `sql` (`@/lib/db`)
- Produces: `POST /api/admin/auth/login`, `POST /api/admin/auth/logout`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/admin-login-route.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/admin-auth";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function login(body: unknown) {
  const { POST } = await import("@/app/api/admin/auth/login/route");
  const { NextRequest } = await import("next/server");
  return POST(
    new NextRequest("http://localhost/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/admin/auth/login", () => {
  it("rejects a missing username/password without touching the database", async () => {
    const res = await login({ username: "owner" });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown username", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await login({ username: "ghost", password: "whatever" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a deactivated account without checking the password", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock.mockResolvedValueOnce([
      { id: 1, password_hash: hash, role: "operator", is_active: false, failed_attempts: 0, locked_until: null },
    ]);
    const res = await login({ username: "ops", password: "correct-password" });
    expect(res.status).toBe(401);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("returns 423 while locked out, without verifying the password", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock.mockResolvedValueOnce([
      {
        id: 1, password_hash: hash, role: "operator", is_active: true,
        failed_attempts: 5, locked_until: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);
    const res = await login({ username: "ops", password: "correct-password" });
    expect(res.status).toBe(423);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("locks the account after the 5th consecutive failure", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock
      .mockResolvedValueOnce([
        { id: 1, password_hash: hash, role: "operator", is_active: true, failed_attempts: 4, locked_until: null },
      ])
      .mockResolvedValueOnce([]);
    const res = await login({ username: "ops", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(sqlMock).toHaveBeenCalledTimes(2);
    const updateCall = sqlMock.mock.calls[1][0].join("");
    expect(updateCall).toContain("UPDATE admin_users");
  });

  it("logs in successfully, resets the failure counter, and sets the admin cookie", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock
      .mockResolvedValueOnce([
        { id: 42, password_hash: hash, role: "super_admin", is_active: true, failed_attempts: 2, locked_until: null },
      ])
      .mockResolvedValueOnce([]);
    const res = await login({ username: "owner", password: "correct-password" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, role: "super_admin" });
    expect(res.cookies.get("bfl_admin_session")?.value).toBeTruthy();
  });
});

describe("POST /api/admin/auth/logout", () => {
  it("clears the admin cookie", async () => {
    const { POST } = await import("@/app/api/admin/auth/logout/route");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(res.cookies.get("bfl_admin_session")?.value).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-login-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/admin/auth/login/route"`

- [ ] **Step 3: Write minimal implementation**

Create `web/app/api/admin/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { normalizeUsername, verifyPassword } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionToken } from "@/lib/admin-session";
import { sql } from "@/lib/db";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  if (typeof o.username !== "string" || typeof o.password !== "string") {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const normalized = normalizeUsername(o.username);
  const [row] = await sql`
    SELECT id, password_hash, role, is_active, failed_attempts, locked_until
    FROM admin_users WHERE lower(trim(username)) = ${normalized}`;
  const invalid = () => NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });

  if (!row || !row.is_active) return invalid();
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "로그인 시도가 많아 잠시 잠겼습니다. 15분 후 다시 시도해주세요." },
      { status: 423 },
    );
  }

  const valid = await verifyPassword(o.password, row.password_hash);
  if (!valid) {
    const attempts = row.failed_attempts + 1;
    const lockedUntil = attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await sql`
      UPDATE admin_users SET failed_attempts = ${attempts}, locked_until = ${lockedUntil}
      WHERE id = ${row.id}`;
    return invalid();
  }

  await sql`UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ${row.id}`;
  const token = await createAdminSessionToken(row.id, row.role);
  const res = NextResponse.json({ ok: true, role: row.role });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions);
  return res;
}
```

Create `web/app/api/admin/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-login-route.test.ts`
Expected: PASS (7개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add web/app/api/admin/auth web/__tests__/admin-login-route.test.ts
git commit -m "feat(bfl-map): add admin login/logout routes with lockout"
```

---

### Task 8: `/api/admin/stats` (기존 `/api/stats` 대체)

**Files:**
- Create: `web/app/api/admin/stats/route.ts`
- Delete: `web/app/api/stats/route.ts`
- Test: `web/__tests__/admin-stats-route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/admin-session`), `sql` (`@/lib/db`)
- Produces: `GET /api/admin/stats` → `{ dau, wau, mau, asOf }`

- [ ] **Step 1: 쓰는 곳이 없는지 재확인**

Run: `cd Bfl_map/web && grep -rn "/api/stats" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: 결과 없음 (이미 확인했지만 삭제 직전 다시 확인).

- [ ] **Step 2: Write the failing test**

Create `web/__tests__/admin-stats-route.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function call(token?: string) {
  const { GET } = await import("@/app/api/admin/stats/route");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `bfl_admin_session=${token}`;
  return GET(new NextRequest("http://localhost/api/admin/stats", { headers }));
}

describe("GET /api/admin/stats", () => {
  it("requires an admin session", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns dau/wau/mau for a logged-in admin", async () => {
    const { createAdminSessionToken } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(1, "operator");
    sqlMock.mockResolvedValueOnce([{ dau: 3, wau: 10, mau: 40 }]);
    const res = await call(token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dau).toBe(3);
    expect(body.wau).toBe(10);
    expect(body.mau).toBe(40);
    expect(typeof body.asOf).toBe("string");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-stats-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/admin/stats/route"`

- [ ] **Step 4: Write minimal implementation, delete the old route**

Create `web/app/api/admin/stats/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const [{ dau, wau, mau }] = await sql`
    SELECT
      (SELECT count(*)::int FROM visits WHERE day = CURRENT_DATE) AS dau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 7) AS wau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 30) AS mau`;
  return NextResponse.json({ dau, wau, mau, asOf: new Date().toISOString() });
}
```

Delete `web/app/api/stats/route.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-stats-route.test.ts`
Expected: PASS (2개 테스트 통과)

- [ ] **Step 6: Commit**

```bash
git add web/app/api/admin/stats web/__tests__/admin-stats-route.test.ts
git rm web/app/api/stats/route.ts
git commit -m "feat(bfl-map): move DAU/WAU/MAU stats under admin auth"
```

---

### Task 9: 유저 검색 + 상세 라우트

**Files:**
- Create: `web/app/api/admin/users/route.ts`
- Create: `web/app/api/admin/users/[userId]/route.ts`
- Test: `web/__tests__/admin-users-route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/admin-session`), `sql` (`@/lib/db`)
- Produces:
  - `GET /api/admin/users?q=&limit=&offset=` → `{ users: [...], limit, offset }`
  - `GET /api/admin/users/[userId]` → `{ user: {...}, recentReviews: [...], history: [...] }` | 404

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/admin-users-route.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function adminToken() {
  const { createAdminSessionToken } = await import("@/lib/admin-session");
  return createAdminSessionToken(1, "operator");
}

describe("GET /api/admin/users", () => {
  it("requires an admin session", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("defaults limit to 20 and clamps an oversized limit to 100", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const { NextRequest } = await import("next/server");
    const token = await adminToken();
    sqlMock.mockResolvedValueOnce([]);
    const res = await GET(
      new NextRequest("http://localhost/api/admin/users?limit=99999", { headers: { cookie: `bfl_admin_session=${token}` } }),
    );
    const body = await res.json();
    expect(body.limit).toBe(100);
  });

  it("returns matched users with default pagination", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const { NextRequest } = await import("next/server");
    const token = await adminToken();
    sqlMock.mockResolvedValueOnce([{ user_id: "kakao:1", nickname: "점심러1", created_at: "2026-01-01", suspended_until: null }]);
    const res = await GET(
      new NextRequest("http://localhost/api/admin/users?q=점심", { headers: { cookie: `bfl_admin_session=${token}` } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });
});

describe("GET /api/admin/users/[userId]", () => {
  async function call(userId: string) {
    const mod = await import("@/app/api/admin/users/[userId]/route");
    const { NextRequest } = await import("next/server");
    const token = await adminToken();
    const req = new NextRequest(`http://localhost/api/admin/users/${userId}`, {
      headers: { cookie: `bfl_admin_session=${token}` },
    });
    return mod.GET(req, { params: Promise.resolve({ userId }) });
  }

  it("returns 404 for a user that doesn't exist", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await call("kakao:ghost");
    expect(res.status).toBe(404);
  });

  it("returns user detail, recent reviews, and suspension history", async () => {
    sqlMock
      .mockResolvedValueOnce([{ user_id: "kakao:1", nickname: "점심러1", created_at: "2026-01-01", suspended_until: null, reviewCount: 3 }])
      .mockResolvedValueOnce([{ id: 5, place_id: "abc", taste: 4, convenience: 3, body: "굿", created_at: "2026-08-01" }])
      .mockResolvedValueOnce([{ id: 1, reason: "욕설", duration_label: "1d", suspended_until: "2026-08-02", created_at: "2026-08-01", lifted_at: null, adminUsername: "owner" }]);
    const res = await call("kakao:1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.nickname).toBe("점심러1");
    expect(body.recentReviews).toHaveLength(1);
    expect(body.history).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-users-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/admin/users/route"`

- [ ] **Step 3: Write minimal implementation**

Create `web/app/api/admin/users/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(raw: string | null): number {
  const n = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  const n = raw ? Number(raw) : 0;
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));
  const pattern = `%${q}%`;

  // q가 비어 있으면 첫 항을 true로 만들어 조건 없이 최신순 페이지네이션만 돈다.
  const users = await sql`
    SELECT user_id, nickname, created_at, suspended_until
    FROM users
    WHERE ${q === ""} OR nickname ILIKE ${pattern} OR user_id ILIKE ${pattern}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}`;

  return NextResponse.json({ users, limit, offset });
}
```

Create `web/app/api/admin/users/[userId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const { userId } = await params;

  const [user] = await sql`
    SELECT u.user_id, u.nickname, u.created_at, u.suspended_until,
           (SELECT count(*)::int FROM reviews r WHERE r.user_id = u.user_id) AS "reviewCount"
    FROM users u WHERE u.user_id = ${userId}`;
  if (!user) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const recentReviews = await sql`
    SELECT id, place_id, taste, convenience, body, created_at
    FROM reviews WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 5`;

  const history = await sql`
    SELECT s.id, s.reason, s.duration_label, s.suspended_until, s.created_at,
           s.lifted_at, a.username AS "adminUsername"
    FROM user_suspensions s JOIN admin_users a ON a.id = s.admin_id
    WHERE s.user_id = ${userId}
    ORDER BY s.created_at DESC LIMIT 50`;

  return NextResponse.json({ user, recentReviews, history });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-users-route.test.ts`
Expected: PASS (5개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add web/app/api/admin/users web/__tests__/admin-users-route.test.ts
git commit -m "feat(bfl-map): add admin user search and detail routes"
```

---

### Task 10: 정지 걸기 / 해제 라우트

**Files:**
- Create: `web/app/api/admin/users/[userId]/suspend/route.ts`
- Create: `web/app/api/admin/users/[userId]/unsuspend/route.ts`
- Test: `web/__tests__/admin-suspend-route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/admin-session`), `durationToSuspendedUntil`, `isValidDurationLabel` (`@/lib/suspension`), `sql`(with `.transaction`) (`@/lib/db`)
- Produces: `POST /api/admin/users/[userId]/suspend`, `POST /api/admin/users/[userId]/unsuspend`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/admin-suspend-route.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock, transactionMock } = vi.hoisted(() => ({ sqlMock: vi.fn(), transactionMock: vi.fn() }));
sqlMock.transaction = transactionMock;
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  sqlMock.mockReset();
  transactionMock.mockReset();
  transactionMock.mockResolvedValue([]);
});

async function adminToken() {
  const { createAdminSessionToken } = await import("@/lib/admin-session");
  return createAdminSessionToken(9, "operator");
}

async function call(kind: "suspend" | "unsuspend", userId: string, body?: unknown) {
  const mod = await import(`@/app/api/admin/users/[userId]/${kind}/route`);
  const { NextRequest } = await import("next/server");
  const token = await adminToken();
  const req = new NextRequest(`http://localhost/api/admin/users/${userId}/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `bfl_admin_session=${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return mod.POST(req, { params: Promise.resolve({ userId }) });
}

describe("POST /api/admin/users/[userId]/suspend", () => {
  it("rejects an invalid duration without touching the database", async () => {
    const res = await call("suspend", "kakao:1", { duration: "2h", reason: "abuse" });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects an empty reason", async () => {
    const res = await call("suspend", "kakao:1", { duration: "1d", reason: "  " });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user doesn't exist", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await call("suspend", "kakao:ghost", { duration: "1d", reason: "abuse" });
    expect(res.status).toBe(404);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("writes both tables in one transaction and returns the expiry", async () => {
    sqlMock.mockResolvedValueOnce([{ user_id: "kakao:1" }]);
    const res = await call("suspend", "kakao:1", { duration: "1h", reason: "abuse" });
    expect(res.status).toBe(200);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.suspendedUntil).toBe("string");
  });
});

describe("POST /api/admin/users/[userId]/unsuspend", () => {
  it("returns 404 when the target user doesn't exist", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await call("unsuspend", "kakao:ghost");
    expect(res.status).toBe(404);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("clears the suspension and lifts the open history row in one transaction", async () => {
    sqlMock.mockResolvedValueOnce([{ user_id: "kakao:1" }]);
    const res = await call("unsuspend", "kakao:1");
    expect(res.status).toBe(200);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-suspend-route.test.ts`
Expected: FAIL — `Failed to resolve import ".../suspend/route"`

- [ ] **Step 3: Write minimal implementation**

Create `web/app/api/admin/users/[userId]/suspend/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";
import { durationToSuspendedUntil, isValidDurationLabel } from "@/lib/suspension";

type Params = { params: Promise<{ userId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const { userId } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  if (!isValidDurationLabel(o.duration)) {
    return NextResponse.json({ error: "정지 기간이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof o.reason !== "string" || o.reason.trim().length === 0) {
    return NextResponse.json({ error: "정지 사유를 입력해주세요." }, { status: 400 });
  }

  const [target] = await sql`SELECT user_id FROM users WHERE user_id = ${userId}`;
  if (!target) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const suspendedUntil = durationToSuspendedUntil(o.duration);
  const reason = o.reason.trim();
  await sql.transaction([
    sql`UPDATE users SET suspended_until = ${suspendedUntil} WHERE user_id = ${userId}`,
    sql`
      INSERT INTO user_suspensions (user_id, admin_id, reason, duration_label, suspended_until)
      VALUES (${userId}, ${ctx.session.adminId}, ${reason}, ${o.duration}, ${suspendedUntil})`,
  ]);

  return NextResponse.json({ ok: true, suspendedUntil: suspendedUntil.toISOString() });
}
```

Create `web/app/api/admin/users/[userId]/unsuspend/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ userId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const { userId } = await params;

  const [target] = await sql`SELECT user_id FROM users WHERE user_id = ${userId}`;
  if (!target) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  await sql.transaction([
    sql`UPDATE users SET suspended_until = NULL WHERE user_id = ${userId}`,
    sql`
      UPDATE user_suspensions SET lifted_at = now(), lifted_by = ${ctx.session.adminId}
      WHERE user_id = ${userId} AND lifted_at IS NULL AND suspended_until > now()`,
  ]);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-suspend-route.test.ts`
Expected: PASS (6개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add web/app/api/admin/users/[userId]/suspend web/app/api/admin/users/[userId]/unsuspend web/__tests__/admin-suspend-route.test.ts
git commit -m "feat(bfl-map): add transactional suspend/unsuspend routes"
```

---

### Task 11: 운영자 계정 관리 라우트

**Files:**
- Create: `web/app/api/admin/operators/route.ts`
- Create: `web/app/api/admin/operators/[id]/deactivate/route.ts`
- Test: `web/__tests__/admin-operators-route.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (`@/lib/admin-auth`), `requireAdmin` (`@/lib/admin-session`), `sql` (`@/lib/db`)
- Produces: `GET/POST /api/admin/operators`, `POST /api/admin/operators/[id]/deactivate`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/admin-operators-route.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function tokenFor(role: "super_admin" | "operator", adminId = 1) {
  const { createAdminSessionToken } = await import("@/lib/admin-session");
  return createAdminSessionToken(adminId, role);
}

describe("GET/POST /api/admin/operators", () => {
  it("returns 403 for an operator", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("operator");
    const res = await mod.GET(new NextRequest("http://localhost/api/admin/operators", { headers: { cookie: `bfl_admin_session=${token}` } }));
    expect(res.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("lists operators for a super_admin", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin");
    sqlMock.mockResolvedValueOnce([{ id: 1, username: "owner", role: "super_admin", is_active: true, created_at: "2026-01-01" }]);
    const res = await mod.GET(new NextRequest("http://localhost/api/admin/operators", { headers: { cookie: `bfl_admin_session=${token}` } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.operators).toHaveLength(1);
  });

  it("rejects a short username without touching the database", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin");
    const res = await mod.POST(
      new NextRequest("http://localhost/api/admin/operators", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `bfl_admin_session=${token}` },
        body: JSON.stringify({ username: "ab", password: "longenough1", role: "operator" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("creates an operator account", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin", 1);
    sqlMock.mockResolvedValueOnce([{ id: 2 }]);
    const res = await mod.POST(
      new NextRequest("http://localhost/api/admin/operators", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `bfl_admin_session=${token}` },
        body: JSON.stringify({ username: "new-ops", password: "longenough1", role: "operator" }),
      }),
    );
    expect(res.status).toBe(201);
  });

  it("reports a duplicate username as 409", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin");
    sqlMock.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }));
    const res = await mod.POST(
      new NextRequest("http://localhost/api/admin/operators", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `bfl_admin_session=${token}` },
        body: JSON.stringify({ username: "owner", password: "longenough1", role: "operator" }),
      }),
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /api/admin/operators/[id]/deactivate", () => {
  async function call(id: string, adminId = 1) {
    const mod = await import("@/app/api/admin/operators/[id]/deactivate/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin", adminId);
    const req = new NextRequest(`http://localhost/api/admin/operators/${id}/deactivate`, {
      method: "POST",
      headers: { cookie: `bfl_admin_session=${token}` },
    });
    return mod.POST(req, { params: Promise.resolve({ id }) });
  }

  it("refuses to deactivate yourself", async () => {
    const res = await call("1", 1);
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the last active super_admin", async () => {
    sqlMock
      .mockResolvedValueOnce([{ role: "super_admin", is_active: true }])
      .mockResolvedValueOnce([{ count: 1 }]);
    const res = await call("2", 1);
    expect(res.status).toBe(400);
  });

  it("deactivates an operator", async () => {
    sqlMock.mockResolvedValueOnce([{ role: "operator", is_active: true }]).mockResolvedValueOnce([]);
    const res = await call("2", 1);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-operators-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/admin/operators/route"`

- [ ] **Step 3: Write minimal implementation**

Create `web/app/api/admin/operators/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

function isDuplicateUsername(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, { requireRole: "super_admin" });
  if (!ctx.ok) return ctx.response;
  const operators = await sql`
    SELECT id, username, role, is_active, created_at FROM admin_users ORDER BY created_at ASC`;
  return NextResponse.json({ operators });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, { requireRole: "super_admin" });
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  if (typeof o.username !== "string" || o.username.trim().length < 3) {
    return NextResponse.json({ error: "아이디는 3자 이상이어야 합니다." }, { status: 400 });
  }
  if (typeof o.password !== "string" || o.password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (o.role !== "super_admin" && o.role !== "operator") {
    return NextResponse.json({ error: "등급이 올바르지 않습니다." }, { status: 400 });
  }

  const passwordHash = await hashPassword(o.password);
  try {
    const [row] = await sql`
      INSERT INTO admin_users (username, password_hash, role, created_by)
      VALUES (${o.username.trim()}, ${passwordHash}, ${o.role}, ${ctx.session.adminId})
      RETURNING id`;
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (e) {
    if (isDuplicateUsername(e)) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
    throw e;
  }
}
```

Create `web/app/api/admin/operators/[id]/deactivate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req, { requireRole: "super_admin" });
  if (!ctx.ok) return ctx.response;
  const { id: rawId } = await params;
  const targetId = Number(rawId);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  if (targetId === ctx.session.adminId) {
    return NextResponse.json({ error: "본인 계정은 비활성화할 수 없습니다." }, { status: 400 });
  }

  const [target] = await sql`SELECT role, is_active FROM admin_users WHERE id = ${targetId}`;
  if (!target) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  if (target.role === "super_admin" && target.is_active) {
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM admin_users WHERE role = 'super_admin' AND is_active = true`;
    if (count <= 1) {
      return NextResponse.json({ error: "마지막 최고관리자는 비활성화할 수 없습니다." }, { status: 400 });
    }
  }

  await sql`UPDATE admin_users SET is_active = false WHERE id = ${targetId}`;
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-operators-route.test.ts`
Expected: PASS (8개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add web/app/api/admin/operators web/__tests__/admin-operators-route.test.ts
git commit -m "feat(bfl-map): add operator account management routes with safeguards"
```

---

### Task 12: 정지 집행 (리뷰 작성/수정·닉네임 변경 차단)

**Files:**
- Modify: `web/app/api/reviews/route.ts`
- Modify: `web/app/api/reviews/[id]/route.ts`
- Modify: `web/app/api/auth/nickname/route.ts`
- Modify: `web/__tests__/review-edit.test.ts`
- Modify: `web/__tests__/nickname-route.test.ts`
- Test: `web/__tests__/suspension-enforcement.test.ts`

**Interfaces:**
- Consumes: `isSuspended` (`@/lib/suspension-server`), `isPermanentSuspension` (`@/lib/suspension`), `kstDateTime` (`@/lib/kst`), `suspensionNotice` (`@/lib/legal`)

정지 체크는 **auth(401) → 입력 검증(400) → 정지 체크(403) → 비즈니스 로직 쿼리** 순서로 넣는다. 이 순서를 지켜야 "잘못된 입력은 DB를 안 건드린다"는 기존 테스트들이 그대로 통과한다.

- [ ] **Step 1: `POST /api/reviews`에 정지 체크 삽입**

`web/app/api/reviews/route.ts`의 `POST` 함수에서, `validateReviewInput` 통과 직후 · 쿨다운 조회 쿼리 이전에 삽입:

```ts
import { NextRequest, NextResponse } from "next/server";
import { PLACE_ID_RE } from "@/lib/constants";
import { sql } from "@/lib/db";
import { kstDate, kstDateTime } from "@/lib/kst";
import { suspensionNotice } from "@/lib/legal";
import { validateReviewInput } from "@/lib/reviews";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isPermanentSuspension } from "@/lib/suspension";
import { isSuspended } from "@/lib/suspension-server";
```
(import 블록 교체 — 기존 `kstDate` 옆에 `kstDateTime` 추가, 나머지 세 줄 신규)

`POST` 함수 안, 기존:
```ts
  const v = validateReviewInput(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { placeId, taste, convenience, body } = v.value;
```
바로 뒤에 추가:
```ts
  const suspension = await isSuspended(session.userId);
  if (suspension.suspended) {
    const until = suspension.until!;
    const notice = suspensionNotice(isPermanentSuspension(until) ? null : kstDateTime(until));
    return NextResponse.json({ error: notice }, { status: 403 });
  }
```

- [ ] **Step 2: `PATCH /api/reviews/[id]`에 정지 체크 삽입**

`web/app/api/reviews/[id]/route.ts` 상단 import에 추가:
```ts
import { kstDateTime } from "@/lib/kst";
import { suspensionNotice } from "@/lib/legal";
import { isPermanentSuspension } from "@/lib/suspension";
import { isSuspended } from "@/lib/suspension-server";
```

`PATCH` 함수에서, 기존:
```ts
  const v = validateReviewBody(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
```
바로 뒤에 추가:
```ts
  const suspension = await isSuspended(ctx.userId);
  if (suspension.suspended) {
    const until = suspension.until!;
    const notice = suspensionNotice(isPermanentSuspension(until) ? null : kstDateTime(until));
    return NextResponse.json({ error: notice }, { status: 403 });
  }
```
`DELETE` 함수는 그대로 둔다.

- [ ] **Step 3: `PUT /api/auth/nickname`에 정지 체크 삽입**

`web/app/api/auth/nickname/route.ts` 상단 import에 추가:
```ts
import { kstDateTime } from "@/lib/kst";
import { suspensionNotice } from "@/lib/legal";
import { isPermanentSuspension } from "@/lib/suspension";
import { isSuspended } from "@/lib/suspension-server";
```

`PUT` 함수에서, 기존:
```ts
  const v = validateNickname(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
```
바로 뒤에 추가:
```ts
  const suspension = await isSuspended(session.userId);
  if (suspension.suspended) {
    const until = suspension.until!;
    const notice = suspensionNotice(isPermanentSuspension(until) ? null : kstDateTime(until));
    return NextResponse.json({ error: notice }, { status: 403 });
  }
```

- [ ] **Step 4: 기존 `review-edit.test.ts`를 새 쿼리 순서에 맞게 고친다**

`web/__tests__/review-edit.test.ts`의 `PATCH /api/reviews/[id]` describe 블록에서 다음 두 테스트를 교체한다.

기존:
```ts
  it("updates the caller's own review", async () => {
    sqlMock.mockResolvedValueOnce([{ id: 7 }]);
    const res = await call("PATCH", "7");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  // 소유권은 WHERE 절이 판정한다 — 남의 리뷰면 갱신된 행이 0개로 돌아온다.
  it("reports someone else's review as not found rather than forbidden", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await call("PATCH", "7");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "찾을 수 없습니다." });
  });
```

새로:
```ts
  it("updates the caller's own review", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: null }]).mockResolvedValueOnce([{ id: 7 }]);
    const res = await call("PATCH", "7");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("blocks an edit while the caller is suspended", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: new Date(Date.now() + 60_000).toISOString() }]);
    const res = await call("PATCH", "7");
    expect(res.status).toBe(403);
  });

  // 소유권은 WHERE 절이 판정한다 — 남의 리뷰면 갱신된 행이 0개로 돌아온다.
  it("reports someone else's review as not found rather than forbidden", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: null }]).mockResolvedValueOnce([]);
    const res = await call("PATCH", "7");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "찾을 수 없습니다." });
  });
```

- [ ] **Step 5: 기존 `nickname-route.test.ts`를 새 쿼리 순서에 맞게 고친다**

`web/__tests__/nickname-route.test.ts`에서 다음 여섯 테스트를 교체한다(전부 `mockResolvedValueOnce`/`mockRejectedValueOnce` 체인 맨 앞에 정지 체크용 `[{ suspended_until: null }]`을 하나씩 추가하고, `toHaveBeenCalledTimes`를 1씩 올린다).

기존:
```ts
  it("accepts the first nickname a new account picks", async () => {
    sqlMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러482913" });
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });
```
새로:
```ts
  it("accepts the first nickname a new account picks", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: null }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러482913" });
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });
```

기존:
```ts
  it("treats resubmitting the current nickname as a no-op instead of a rename", async () => {
    // Otherwise a double-click on 확인 would burn the user's one free rename.
    sqlMock.mockResolvedValueOnce([userRow({ nickname: "점심러482913", renamed: true, agoDays: 0 })]);
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러482913" });
    expect(sqlMock).toHaveBeenCalledTimes(1); // no write
  });
```
새로:
```ts
  it("treats resubmitting the current nickname as a no-op instead of a rename", async () => {
    // Otherwise a double-click on 확인 would burn the user's one free rename.
    sqlMock
      .mockResolvedValueOnce([{ suspended_until: null }])
      .mockResolvedValueOnce([userRow({ nickname: "점심러482913", renamed: true, agoDays: 0 })]);
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러482913" });
    expect(sqlMock).toHaveBeenCalledTimes(2); // no write
  });
```

기존:
```ts
  it("allows the first rename even if the name was set moments ago", async () => {
    // People accept the auto-suggested name, then think better of it. Locking
    // them out for a month over that would be punishing the wrong behaviour.
    sqlMock
      .mockResolvedValueOnce([userRow({ nickname: "점심러482913", renamed: false, agoDays: 0 })])
      .mockResolvedValueOnce([]);
    const res = await putNickname("돈까스러버");
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });
```
새로:
```ts
  it("allows the first rename even if the name was set moments ago", async () => {
    // People accept the auto-suggested name, then think better of it. Locking
    // them out for a month over that would be punishing the wrong behaviour.
    sqlMock
      .mockResolvedValueOnce([{ suspended_until: null }])
      .mockResolvedValueOnce([userRow({ nickname: "점심러482913", renamed: false, agoDays: 0 })])
      .mockResolvedValueOnce([]);
    const res = await putNickname("돈까스러버");
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });
```

기존:
```ts
  it("blocks a second rename inside the 30 day window and names the date", async () => {
    sqlMock.mockResolvedValueOnce([userRow({ nickname: "돈까스러버", renamed: true, agoDays: 3 })]);
    const res = await putNickname("국밥러버");
    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toContain("30일에 한 번");
    const expected = new Date(Date.now() + 27 * DAY_MS + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(error).toContain(expected);
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the write
  });
```
새로:
```ts
  it("blocks a second rename inside the 30 day window and names the date", async () => {
    sqlMock
      .mockResolvedValueOnce([{ suspended_until: null }])
      .mockResolvedValueOnce([userRow({ nickname: "돈까스러버", renamed: true, agoDays: 3 })]);
    const res = await putNickname("국밥러버");
    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toContain("30일에 한 번");
    const expected = new Date(Date.now() + 27 * DAY_MS + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(error).toContain(expected);
    expect(sqlMock).toHaveBeenCalledTimes(2); // rejected before the write
  });
```

기존:
```ts
  it("allows a rename once the 30 day window has passed", async () => {
    sqlMock
      .mockResolvedValueOnce([userRow({ nickname: "돈까스러버", renamed: true, agoDays: 31 })])
      .mockResolvedValueOnce([]);
    const res = await putNickname("국밥러버");
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });
```
새로:
```ts
  it("allows a rename once the 30 day window has passed", async () => {
    sqlMock
      .mockResolvedValueOnce([{ suspended_until: null }])
      .mockResolvedValueOnce([userRow({ nickname: "돈까스러버", renamed: true, agoDays: 31 })])
      .mockResolvedValueOnce([]);
    const res = await putNickname("국밥러버");
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });
```

기존:
```ts
  it("reports a nickname already taken by someone else as 409", async () => {
    sqlMock.mockResolvedValueOnce([]).mockRejectedValueOnce(uniqueViolation());
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "이미 사용 중인 닉네임이에요." });
  });

  it("does not swallow an unrelated database failure", async () => {
    sqlMock.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("connection reset"));
    await expect(putNickname("점심러482913")).rejects.toThrow("connection reset");
  });
```
새로:
```ts
  it("reports a nickname already taken by someone else as 409", async () => {
    sqlMock
      .mockResolvedValueOnce([{ suspended_until: null }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(uniqueViolation());
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "이미 사용 중인 닉네임이에요." });
  });

  it("does not swallow an unrelated database failure", async () => {
    sqlMock
      .mockResolvedValueOnce([{ suspended_until: null }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("connection reset"));
    await expect(putNickname("점심러482913")).rejects.toThrow("connection reset");
  });
```

"rejects an anonymous caller"·"rejects an invalid nickname..."·"rejects profanity" 세 테스트는 정지 체크 이전(401/400)에 끝나므로 그대로 둔다.

- [ ] **Step 6: 새 통합 테스트 작성**

Create `web/__tests__/suspension-enforcement.test.ts`:

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

async function sessionCookie() {
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  return `${SESSION_COOKIE}=${await createSessionToken("kakao:suspended-user")}`;
}

function suspendedRow() {
  return { suspended_until: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
}

describe("suspended user is blocked from writing", () => {
  it("POST /api/reviews returns 403", async () => {
    const { POST } = await import("@/app/api/reviews/route");
    const { NextRequest } = await import("next/server");
    sqlMock.mockResolvedValueOnce([suspendedRow()]);
    const res = await POST(
      new NextRequest("http://localhost/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: await sessionCookie() },
        body: JSON.stringify({ placeId: "1080924210", taste: 4, convenience: 3, body: "" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("PATCH /api/reviews/[id] returns 403", async () => {
    const { PATCH } = await import("@/app/api/reviews/[id]/route");
    const { NextRequest } = await import("next/server");
    sqlMock.mockResolvedValueOnce([suspendedRow()]);
    const res = await PATCH(
      new NextRequest("http://localhost/api/reviews/7", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: await sessionCookie() },
        body: JSON.stringify({ taste: 4, convenience: 3, body: "" }),
      }),
      { params: Promise.resolve({ id: "7" }) },
    );
    expect(res.status).toBe(403);
  });

  it("PUT /api/auth/nickname returns 403", async () => {
    const { PUT } = await import("@/app/api/auth/nickname/route");
    const { NextRequest } = await import("next/server");
    sqlMock.mockResolvedValueOnce([suspendedRow()]);
    const res = await PUT(
      new NextRequest("http://localhost/api/auth/nickname", {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: await sessionCookie() },
        body: JSON.stringify({ nickname: "새이름123" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("DELETE /api/reviews/[id] still succeeds", async () => {
    const { DELETE } = await import("@/app/api/reviews/[id]/route");
    const { NextRequest } = await import("next/server");
    sqlMock.mockResolvedValueOnce([{ id: 7 }]);
    const res = await DELETE(
      new NextRequest("http://localhost/api/reviews/7", { method: "DELETE", headers: { cookie: await sessionCookie() } }),
      { params: Promise.resolve({ id: "7" }) },
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 7: Run all affected tests**

Run: `cd Bfl_map/web && npm test -- review-edit.test.ts nickname-route.test.ts suspension-enforcement.test.ts`
Expected: PASS 전부.

- [ ] **Step 8: 전체 테스트 스위트 실행**

Run: `cd Bfl_map/web && npm test`
Expected: PASS 전부 (기존 테스트 회귀 없음).

- [ ] **Step 9: Commit**

```bash
git add web/app/api/reviews web/app/api/auth/nickname web/__tests__/review-edit.test.ts web/__tests__/nickname-route.test.ts web/__tests__/suspension-enforcement.test.ts
git commit -m "feat(bfl-map): enforce suspension on review write and nickname change"
```

---

### Task 13: 프론트 — 정지 사전 안내 + `/api/auth/me` 확장

**Files:**
- Modify: `web/lib/constants.ts`
- Modify: `web/app/api/auth/me/route.ts`
- Modify: `web/components/ReviewSection.tsx`
- Modify: `web/components/NicknameModal.tsx`
- Modify: `web/components/MapApp.tsx`

**Interfaces:**
- Consumes: `isSuspensionActive`, `isPermanentSuspension` (`@/lib/suspension`), `kstDateTime` (`@/lib/kst`), `suspensionNotice`, `CONTACT_LINE` (`@/lib/legal`)
- Produces: `SessionUser.suspendedUntil: string | null`

`/api/auth/me`는 이미 `req.cookies`를 읽어 매 요청 동적 렌더링이라 별도 캐시 무효화 작업이 필요 없다 — 정지 해제 직후 바로 반영된다.

- [ ] **Step 1: `SessionUser` 타입 확장**

`web/lib/constants.ts`의 기존:
```ts
export type SessionUser = { userId: string; nickname: string | null };
```
를:
```ts
export type SessionUser = { userId: string; nickname: string | null; suspendedUntil: string | null };
```
로 바꾼다.

- [ ] **Step 2: `/api/auth/me`가 정지 상태를 내려주게 한다**

`web/app/api/auth/me/route.ts` 전체를 다음으로 교체:

```ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ user: null });

  // 표시 이름의 출처는 여기 하나뿐이다. nickname이 null이면 프론트가 설정 모달을 띄운다.
  const [row] = await sql`SELECT nickname, suspended_until FROM users WHERE user_id = ${session.userId}`;
  return NextResponse.json({
    user: {
      userId: session.userId,
      nickname: row?.nickname ?? null,
      suspendedUntil: row?.suspended_until ?? null,
    },
  });
}
```

- [ ] **Step 3: `ReviewSection.tsx`에 사전 배너 + 작성 폼 잠금**

`web/components/ReviewSection.tsx` 상단 import에 추가:
```ts
import { kstDateTime } from "@/lib/kst";
import { CONTACT_LINE, suspensionNotice } from "@/lib/legal";
import { isPermanentSuspension, isSuspensionActive } from "@/lib/suspension";
```

`ReviewSection` 함수 본문, `const [listError, setListError] = useState("");` 바로 뒤에 추가:
```ts
  const suspendedUntilDate = user?.suspendedUntil ? new Date(user.suspendedUntil) : null;
  const suspended = isSuspensionActive(suspendedUntilDate);
  const suspendedNotice = suspendedUntilDate
    ? suspensionNotice(isPermanentSuspension(suspendedUntilDate) ? null : kstDateTime(suspendedUntilDate))
    : "";
```

작성 폼(`{user ? (...) : (...)}` 블록의 `user`가 참인 쪽) 전체를 다음으로 교체:
```tsx
      {user ? (
        <div className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <h4 className="font-bold text-text-primary">내 리뷰 작성</h4>
          {suspended && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {suspendedNotice}
              <br />
              {CONTACT_LINE}
            </p>
          )}
          <fieldset disabled={suspended} className="space-y-4">
            <Stars label="맛" value={taste} onChange={setTaste} />
            <Stars label="점심 편의성" value={convenience} onChange={setConvenience} />
            <textarea
              className="w-full rounded-lg bg-surface-muted p-3 text-base text-text-primary placeholder:text-text-muted disabled:opacity-50"
              rows={2}
              maxLength={MAX_LEN}
              placeholder="100자 이내로 짧게(사진은 나중에, 우리는 직장인이라 바쁘니까)"
              value={body}
              onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">{[...body].length}/{MAX_LEN}</span>
              <button
                className="h-11 rounded-lg bg-ink px-6 text-sm font-bold text-white disabled:opacity-50"
                disabled={busy || suspended}
                onClick={submit}
              >
                {busy ? "저장 중…" : "리뷰 남기기"}
              </button>
            </div>
          </fieldset>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-4 rounded-lg border border-border p-4 text-center shadow-xs">
          <p className="text-base text-text-muted">리뷰를 남기려면 로그인이 필요합니다.</p>
          <a
            className="grid h-11 place-items-center rounded-lg bg-ink text-center text-base font-bold text-white"
            href="/api/auth/kakao"
          >
            카카오로 로그인하고 리뷰 남기기
          </a>
        </div>
      )}
```

내 리뷰 목록의 "수정" 버튼을 정지 중엔 숨긴다(삭제는 유지). 기존:
```tsx
                {rv.mine && (
                  <div className="mt-2 flex justify-end gap-1">
                    <button
                      className="h-11 rounded-lg px-3 text-sm font-medium text-text-muted"
                      onClick={() => setEditing(rv.id)}
                    >
                      수정
                    </button>
                    <button
                      className="h-11 rounded-lg px-3 text-sm font-medium text-text-muted"
                      onClick={() => remove(rv.id)}
                    >
                      삭제
                    </button>
                  </div>
                )}
```
를:
```tsx
                {rv.mine && (
                  <div className="mt-2 flex justify-end gap-1">
                    {!suspended && (
                      <button
                        className="h-11 rounded-lg px-3 text-sm font-medium text-text-muted"
                        onClick={() => setEditing(rv.id)}
                      >
                        수정
                      </button>
                    )}
                    <button
                      className="h-11 rounded-lg px-3 text-sm font-medium text-text-muted"
                      onClick={() => remove(rv.id)}
                    >
                      삭제
                    </button>
                  </div>
                )}
```
로 바꾼다.

- [ ] **Step 4: `NicknameModal.tsx`에 정지 안내(edit 모드)**

`web/components/NicknameModal.tsx` 상단 import에 추가:
```ts
import { kstDateTime } from "@/lib/kst";
import { CONTACT_LINE, suspensionNotice } from "@/lib/legal";
import { isPermanentSuspension, isSuspensionActive } from "@/lib/suspension";
```

`Props` 타입에 추가:
```ts
  /** edit 모드에서만 쓴다. 정지 중이면 배너를 보여주고 입력을 잠근다. */
  suspendedUntil?: string | null;
```

함수 시그니처를:
```ts
export default function NicknameModal({
  mode, initial, suspendedUntil = null, onSaved, onClose, onWithdrawn, onLogout,
}: Props) {
```
로 바꾸고, `const [value, setValue] = useState(initial);` 바로 뒤에 추가:
```ts
  const suspendedUntilDate = suspendedUntil ? new Date(suspendedUntil) : null;
  const suspended = isSuspensionActive(suspendedUntilDate);
  const suspendedNotice = suspendedUntilDate
    ? suspensionNotice(isPermanentSuspension(suspendedUntilDate) ? null : kstDateTime(suspendedUntilDate))
    : "";
```

edit 모드 폼의 안내 문단(`<p className="mt-2 text-sm text-text-muted">리뷰에 이 이름으로...`) 바로 뒤에 추가:
```tsx
      {suspended && (
        <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {suspendedNotice}
          <br />
          {CONTACT_LINE}
        </p>
      )}
```

`<input ref={inputRef} ...>`에 `disabled={suspended}` 추가, 제출 버튼의 `disabled={busy}`를 `disabled={busy || suspended}`로 바꾼다.

- [ ] **Step 5: `MapApp.tsx`에서 `suspendedUntil` 전달**

`web/components/MapApp.tsx`의 edit 모드 `NicknameModal` 호출:
```tsx
        {user?.nickname && editingNickname && (
          <NicknameModal
            mode="edit"
            initial={user.nickname}
            onSaved={n => { setUser({ ...user, nickname: n }); setEditingNickname(false); }}
```
을:
```tsx
        {user?.nickname && editingNickname && (
          <NicknameModal
            mode="edit"
            initial={user.nickname}
            suspendedUntil={user.suspendedUntil}
            onSaved={n => { setUser({ ...user, nickname: n }); setEditingNickname(false); }}
```
로 바꾼다.

- [ ] **Step 6: 타입 체크 + 기존 테스트 재확인**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test`
Expected: 타입 에러 없음, 전체 테스트 PASS.

- [ ] **Step 7: 수동 확인**

Run: `cd Bfl_map/web && npm run dev`
- `sql.transaction`으로 임의 유저를 1시간 정지시킨 뒤(Task 10 라우트를 curl로 호출하거나 다음 태스크의 `/admin` 완성 후 확인해도 된다) 그 계정으로 로그인해 리뷰 작성 폼에 안내 배너가 뜨고 입력이 잠기는지, 내 리뷰의 "수정"이 사라지고 "삭제"는 남아 있는지 브라우저로 확인한다.

- [ ] **Step 8: Commit**

```bash
git add web/lib/constants.ts web/app/api/auth/me web/components/ReviewSection.tsx web/components/NicknameModal.tsx web/components/MapApp.tsx
git commit -m "feat(bfl-map): show suspension banner and lock write forms client-side"
```

---

### Task 14: `/admin/login` 페이지

**Files:**
- Create: `web/components/admin/AdminLoginForm.tsx`
- Create: `web/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/auth/login`, `ADMIN_SESSION_COOKIE`/`verifyAdminSessionToken` (`@/lib/admin-session`)

- [ ] **Step 1: 로그인 폼 컴포넌트**

Create `web/components/admin/AdminLoginForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).catch(() => null);
    setBusy(false);
    if (!res) { setError("네트워크 오류가 발생했어요. 다시 시도해주세요."); return; }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "로그인에 실패했어요.");
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="mx-auto mt-24 max-w-xs px-6">
      <h1 className="text-lg font-bold text-text-primary">운영자 로그인</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          placeholder="아이디"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          className="h-11 w-full rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
          disabled={busy || !username || !password}
        >
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 페이지 (이미 로그인 상태면 `/admin`으로)**

Create `web/app/admin/login/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

export default async function AdminLoginPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (session) redirect("/admin");
  return <AdminLoginForm />;
}
```

- [ ] **Step 3: 타입 체크**

Run: `cd Bfl_map/web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 확인**

Run: `cd Bfl_map/web && npm run dev` 후 브라우저로 `/admin/login`에서 Task 6 시드 계정으로 로그인 → 쿠키가 잡히는지, 성공 시 `/admin`으로 이동하는지 확인(다음 태스크 전까지는 `/admin`이 404일 수 있다 — 로그인 성공 자체와 쿠키만 확인).

- [ ] **Step 5: Commit**

```bash
git add web/components/admin/AdminLoginForm.tsx web/app/admin/login
git commit -m "feat(bfl-map): add admin login page"
```

---

### Task 15: `/admin` 대시보드 페이지

**Files:**
- Create: `web/components/admin/AdminDashboard.tsx`
- Create: `web/app/admin/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/stats`, `GET /api/admin/users`, `GET /api/admin/users/[userId]`, `POST .../suspend`, `POST .../unsuspend`, `POST /api/admin/auth/logout`, `isSuspensionActive` (`@/lib/suspension`)

- [ ] **Step 1: 대시보드 컴포넌트**

Create `web/components/admin/AdminDashboard.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { isSuspensionActive } from "@/lib/suspension";

type UserRow = { user_id: string; nickname: string; created_at: string; suspended_until: string | null };
type SuspensionRecord = {
  id: number; reason: string; duration_label: string; suspended_until: string;
  created_at: string; lifted_at: string | null; adminUsername: string;
};
type UserDetail = {
  user: { user_id: string; nickname: string; created_at: string; suspended_until: string | null; reviewCount: number };
  recentReviews: { id: number; place_id: string; taste: number; convenience: number; body: string; created_at: string }[];
  history: SuspensionRecord[];
};
type Stats = { dau: number; wau: number; mau: number };

const DURATIONS = [
  { label: "1시간", value: "1h" },
  { label: "3시간", value: "3h" },
  { label: "1일", value: "1d" },
  { label: "3일", value: "3d" },
  { label: "7일", value: "7d" },
  { label: "영구", value: "permanent" },
];

function isActive(until: string | null): boolean {
  return isSuspensionActive(until ? new Date(until) : null);
}

function UserDetailPanel({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState("1d");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/users/${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(load, [load]);

  const suspend = async () => {
    setError("");
    if (reason.trim() === "") { setError("정지 사유를 입력해주세요."); return; }
    setBusy(true);
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration, reason }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = (await res?.json().catch(() => ({}))) ?? {};
      setError(d.error ?? "정지 처리에 실패했어요.");
      return;
    }
    setReason("");
    load();
    onChanged();
  };

  const unsuspend = async () => {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/unsuspend`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { setError("해제에 실패했어요."); return; }
    load();
    onChanged();
  };

  if (loading) return <p className="p-4 text-sm text-text-muted">불러오는 중…</p>;
  if (!detail) return <p className="p-4 text-sm text-red-600">불러오지 못했어요.</p>;

  const suspended = isActive(detail.user.suspended_until);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h3 className="font-bold text-text-primary">{detail.user.nickname}</h3>
        <p className="text-xs text-text-muted">
          {detail.user.user_id} · 가입 {detail.user.created_at.slice(0, 10)} · 리뷰 {detail.user.reviewCount}개
        </p>
        <p className="mt-1 text-sm font-medium">
          {suspended ? (
            <span className="text-red-600">
              정지 중{detail.user.suspended_until && ` (${detail.user.suspended_until.slice(0, 16).replace("T", " ")}까지)`}
            </span>
          ) : (
            <span className="text-green-700">정상</span>
          )}
        </p>
      </div>

      {suspended ? (
        <button
          className="h-11 rounded-lg bg-surface-muted px-4 text-sm font-bold text-text-primary disabled:opacity-50"
          disabled={busy}
          onClick={unsuspend}
        >
          {busy ? "처리 중…" : "정지 해제"}
        </button>
      ) : (
        <div className="space-y-2">
          <select
            className="h-11 w-full rounded-lg bg-surface-muted px-3 text-sm text-text-primary"
            value={duration}
            onChange={e => setDuration(e.target.value)}
          >
            {DURATIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <textarea
            className="w-full rounded-lg bg-surface-muted p-3 text-sm text-text-primary"
            rows={2}
            placeholder="정지 사유 (내부 기록용)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <button
            className="h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={suspend}
          >
            {busy ? "처리 중…" : "정지"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      <div>
        <h4 className="text-sm font-bold text-text-primary">최근 리뷰</h4>
        {detail.recentReviews.length === 0 ? (
          <p className="text-xs text-text-muted">없음</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs text-text-muted">
            {detail.recentReviews.map(r => (
              <li key={r.id}>{r.created_at.slice(0, 10)} · {r.place_id} · ★{r.taste}/{r.convenience} · {r.body}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-text-primary">정지 이력</h4>
        {detail.history.length === 0 ? (
          <p className="text-xs text-text-muted">없음</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs text-text-muted">
            {detail.history.map(h => (
              <li key={h.id}>
                {h.created_at.slice(0, 10)} · {h.duration_label} · {h.reason} · by {h.adminUsername}
                {h.lifted_at && ` · 해제됨(${h.lifted_at.slice(0, 10)})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard({ role }: { role: "super_admin" | "operator" }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(setStats);
  }, []);

  const search = useCallback(() => {
    setSearching(true);
    fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .finally(() => setSearching(false));
  }, [query]);

  useEffect(search, [search]);

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/admin/login";
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">어드민</h1>
        <div className="flex items-center gap-3">
          {role === "super_admin" && (
            <a href="/admin/operators" className="text-sm text-accent underline">운영자 관리</a>
          )}
          <button className="text-sm text-text-muted underline" onClick={logout}>로그아웃</button>
        </div>
      </div>

      {stats && (
        <p className="mt-4 rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-medium text-text-primary">
          DAU {stats.dau} · WAU {stats.wau} · MAU {stats.mau}
        </p>
      )}

      <div className="mt-6">
        <input
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          placeholder="닉네임 또는 유저 ID 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {searching && <p className="mt-2 text-xs text-text-muted">검색 중…</p>}
        <ul className="mt-2 space-y-1">
          {users.map(u => (
            <li key={u.user_id}>
              <button
                className={`h-11 w-full rounded-lg px-3 text-left text-sm ${
                  selected === u.user_id ? "bg-ink text-white" : "bg-surface-muted text-text-primary"
                }`}
                onClick={() => setSelected(u.user_id)}
              >
                {u.nickname} {isActive(u.suspended_until) && "(정지 중)"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="mt-6">
          <UserDetailPanel key={selected} userId={selected} onChanged={search} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 페이지 (인증 가드)**

Create `web/app/admin/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

export default async function AdminPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) redirect("/admin/login");
  return <AdminDashboard role={session.role} />;
}
```

- [ ] **Step 3: 타입 체크**

Run: `cd Bfl_map/web && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 확인**

Run: `cd Bfl_map/web && npm run dev`
- 비로그인 상태로 `/admin` 접속 → `/admin/login`으로 리다이렉트되는지 확인.
- 로그인 후 `/admin`에서 DAU/WAU/MAU가 뜨는지, 유저를 검색해 상세 패널이 열리는지, 정지→해제가 정상 동작하고 정지 이력이 쌓이는지 확인. Task 13에서 만든 배너/폼 잠금이 실제로 반영되는지 이 단계에서 최종 확인한다.

- [ ] **Step 5: Commit**

```bash
git add web/components/admin/AdminDashboard.tsx web/app/admin/page.tsx
git commit -m "feat(bfl-map): add admin dashboard with search, suspend/unsuspend, and stats"
```

---

### Task 16: `/admin/operators` 페이지

**Files:**
- Create: `web/components/admin/OperatorsPage.tsx`
- Create: `web/app/admin/operators/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/admin/operators`, `POST /api/admin/operators/[id]/deactivate`

- [ ] **Step 1: 운영자 관리 컴포넌트**

Create `web/components/admin/OperatorsPage.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type Operator = { id: number; username: string; role: "super_admin" | "operator"; is_active: boolean; created_at: string };

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"super_admin" | "operator">("operator");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/operators").then(r => r.json()).then(d => setOperators(d.operators ?? []));
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/operators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = (await res?.json().catch(() => ({}))) ?? {};
      setError(d.error ?? "생성에 실패했어요.");
      return;
    }
    setUsername("");
    setPassword("");
    load();
  };

  const deactivate = async (id: number) => {
    setError("");
    const res = await fetch(`/api/admin/operators/${id}/deactivate`, { method: "POST" }).catch(() => null);
    if (!res || !res.ok) {
      const d = (await res?.json().catch(() => ({}))) ?? {};
      setError(d.error ?? "비활성화에 실패했어요.");
      return;
    }
    load();
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <a href="/admin" className="text-sm text-accent underline">← 대시보드</a>
      <h1 className="mt-2 text-lg font-bold text-text-primary">운영자 관리</h1>

      <div className="mt-6 space-y-2 rounded-lg border border-border p-4">
        <input
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          placeholder="아이디 (3자 이상)"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          type="password"
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <select
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-sm text-text-primary"
          value={role}
          onChange={e => setRole(e.target.value as "super_admin" | "operator")}
        >
          <option value="operator">운영자</option>
          <option value="super_admin">최고관리자</option>
        </select>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button
          className="h-11 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-50"
          disabled={busy || username.trim().length < 3 || password.length < 8}
          onClick={create}
        >
          {busy ? "생성 중…" : "계정 생성"}
        </button>
      </div>

      <ul className="mt-6 space-y-2">
        {operators.map(op => (
          <li key={op.id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-bold text-text-primary">{op.username}</p>
              <p className="text-xs text-text-muted">
                {op.role === "super_admin" ? "최고관리자" : "운영자"} · {op.is_active ? "활성" : "비활성"}
              </p>
            </div>
            {op.is_active && (
              <button className="text-xs text-red-600 underline" onClick={() => deactivate(op.id)}>
                비활성화
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 페이지 (super_admin 가드)**

Create `web/app/admin/operators/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OperatorsPage from "@/components/admin/OperatorsPage";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";

export default async function AdminOperatorsPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) redirect("/admin/login");
  if (session.role !== "super_admin") redirect("/admin");
  return <OperatorsPage />;
}
```

- [ ] **Step 3: 타입 체크 + 전체 테스트 + 린트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test && npm run lint`
Expected: 전부 통과, 에러 없음.

- [ ] **Step 4: 수동 확인**

Run: `cd Bfl_map/web && npm run dev`
- operator 계정으로 `/admin/operators` 접속 시 `/admin`으로 튕기는지 확인.
- super_admin으로 새 operator 계정을 만들고, 그 계정으로 로그아웃 후 재로그인해 `/admin`은 되고 `/admin/operators`는 막히는지 확인.
- 본인 계정 비활성화 시도(400), 마지막 super_admin 비활성화 시도(400)가 실제로 막히는지 확인.

- [ ] **Step 5: Commit**

```bash
git add web/components/admin/OperatorsPage.tsx web/app/admin/operators
git commit -m "feat(bfl-map): add operator account management page"
```

---

## Self-Review 메모

- **스펙 커버리지:** 운영자 로그인/등급(Task 3,7,11,14,16), 유저 검색/상세(Task 9,15), 정지/해제/이력(Task 10,15), 글쓰기만 차단(Task 12,13), DAU/WAU/MAU(Task 8,15), 6가지 보강(아이디 정규화-Task2·해시 포맷-Task2·영구정지 상수-Task4·페이지네이션 필수-Task9·트랜잭션-Task10·아이디 길이 체크-Task1) 모두 태스크로 연결됨. UX 보강 4가지(문구 개선-Task4, 사전 배너-Task13, 캐시 프레시니스-Task13에서 근거 명시, 운영자 상세 정보-Task9/15) 반영됨.
- **드롭한 항목:** "정지 이력에 최근 로그인 시각" — `users` 행이 첫 닉네임 설정 때만 생기고 카카오 콜백은 그 행을 건드리지 않는 구조라, 로그인마다 갱신하려면 OAuth 콜백에 upsert를 넣어야 한다. 정지 기능과 무관한 인증 경로를 건드리는 리스크가 이득보다 커서 이번 범위에서 뺐다.
- **`reason` 필드:** 유저에게 보여줄 문구를 따로 저장하지 않는다 — 정지 문구는 호출부가 상태(기간/영구)만으로 `suspensionNotice()`(`@/lib/legal`, 기존 코드)를 조합해서 낸다. `reason`은 운영자 간 내부 기록 전용으로만 쓴다. 운영자가 매번 두 문구를 타이핑할 필요가 없고, 내부 사유가 실수로 유저에게 노출될 일도 없다.
- **문구 중복 제거:** 애초 초안은 `lib/suspension.ts`에 독자적인 `suspensionMessage()`를 만들 계획이었으나, 구현 착수 직전 `feature/bfl-map-nickname`에 이미 같은 역할의 `lib/legal.ts`(`suspensionNotice`/`CONTACT_LINE`, 커밋 `72e2273a`)가 올라와 있는 걸 발견해 계획을 이 문서에서 수정했다. `lib/suspension.ts`에는 문구 함수를 두지 않고, 모든 호출부(Task 12 라우트 3곳, Task 13 컴포넌트 2곳)가 기존 `suspensionNotice`/`CONTACT_LINE`을 직접 쓴다 — 동일 역할 함수가 두 벌 존재하지 않는다.
- **타입 일관성:** `SuspensionStatus`, `AdminSession`, `AdminRole`, `DurationLabel`이 정의된 파일(Task 3~5)과 그걸 쓰는 라우트(Task 7~13)에서 이름이 그대로 일치하는지 재확인함.
