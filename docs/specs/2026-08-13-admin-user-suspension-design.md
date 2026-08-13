# 어드민: 운영자 계정 + 사용자 정지

2026-08-13

## 왜

지금 이 서비스엔 관리자 개념이 없다. 부적절한 유저를 막을 방법이 DB에 직접
UPDATE 치는 것뿐이다. 운영자 계정(등급 2단계: 최고관리자/운영자)을 두고,
로그인해서 유저를 검색해 1시간/3시간/1일/3일/7일/영구 정지를 걸고 풀 수 있는
어드민 페이지를 만든다.

기존에 `/api/stats`가 `ADMIN_USER_ID` 환경변수 하나로 "관리자"를 흉내 내고
있었다. 이번에 진짜 운영자 계정 체계가 생기니 그 낡은 게이트는 걷어내고
`/api/admin/stats`로 옮겨 새 인증을 쓴다.

## 범위

- 운영자 로그인 (아이디/비밀번호, 카카오 로그인과 완전 별도)
- 운영자 등급 2단계: `super_admin`(계정 관리 가능) / `operator`(유저 정지만)
- 유저 검색 → 정지/해제 → 정지 이력 조회
- 정지된 유저는 **글쓰기만** 차단(리뷰 작성/수정, 닉네임 변경). 로그인·열람·리뷰
  삭제는 그대로 허용
- 대시보드에 기존 DAU/WAU/MAU 지표 노출 (기존 `/api/stats` 로직 재사용)

**범위 밖:** 리뷰 신고/삭제, 닉네임 강제 초기화, 회원가입형 셀프 운영자 등록.
다음 라운드로 미룬다.

## 스키마

```sql
-- Bfl_map/web/migrations/2026-08-13-admin-users.sql
CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  username        TEXT NOT NULL CHECK (length(trim(username)) >= 3),
  password_hash   TEXT NOT NULL,      -- "scrypt:N:salt_hex:hash_hex" 형식
  role            TEXT NOT NULL CHECK (role IN ('super_admin', 'operator')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      INTEGER REFERENCES admin_users (id)
);
-- 아이디는 가입/로그인 모두 trim + lower() 기준으로 비교한다. 저장은 원본
-- 그대로 두고(표시용), 유니크 판정과 조회만 lower(trim(username))으로 건다.
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_key
  ON admin_users (lower(trim(username)));
```

```sql
-- Bfl_map/web/migrations/2026-08-13-user-suspensions.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
-- NULL = 정상. 영구 정지는 코드 상수 PERMANENT_SUSPENSION_UNTIL
-- ('9999-12-31T23:59:59Z')을 그대로 저장한다 — 별도 boolean 플래그 없이
-- `suspended_until > now()` 하나로 정지 여부를 판정하기 위해서다.

CREATE TABLE IF NOT EXISTS user_suspensions (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users (user_id),
  admin_id        INTEGER NOT NULL REFERENCES admin_users (id),
  reason          TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  duration_label  TEXT NOT NULL CHECK (
    duration_label IN ('1h', '3h', '1d', '3d', '7d', 'permanent')
  ),
  suspended_until TIMESTAMPTZ NOT NULL,  -- permanent도 상수값을 그대로 채운다
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifted_at       TIMESTAMPTZ,
  lifted_by       INTEGER REFERENCES admin_users (id)
);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user
  ON user_suspensions (user_id, created_at DESC);
```

`schema.sql`에도 두 테이블 + `users.suspended_until` 컬럼을 동시에 반영한다
([[bfl-map-project]]가 지적한 "스키마 두 곳 안 맞으면 조용히 깨진다" 함정).

## 인증

- **완전 분리.** 기존 유저 세션(`bfl_session`, `SESSION_SECRET`)과 별도로
  `bfl_admin_session` 쿠키 + `ADMIN_SESSION_SECRET` 환경변수를 새로 쓴다.
  `lib/session.ts`를 건드리지 않고 `lib/admin-session.ts`를 새로 만든다.
  하나가 새도 다른 하나는 안전하게.
- 쿠키는 `httpOnly`, `secure`(prod), `sameSite: lax`, `path: /`, `maxAge: 12h`
  (운영 세션은 짧게 끊어 재로그인을 강제한다).
- **비밀번호 해시:** 새 패키지 없이 Node 내장 `crypto.scrypt` 사용.
  포맷은 `scrypt:<N>:<salt_hex>:<hash_hex>` — 접두사에 알고리즘 버전과 파라미터를
  박아두면 나중에 파라미터를 올리거나 알고리즘을 바꿀 때 기존 해시와 새 해시가
  공존할 수 있다.
- **잠금:** 로그인 5회 연속 실패 시 `locked_until = now() + 15분`. 성공하면
  `failed_attempts = 0`으로 리셋.
- **초기 계정:** `web/scripts/seed-admin.mjs` — 환경변수(`SEED_ADMIN_USERNAME`,
  `SEED_ADMIN_PASSWORD`)를 읽어 `super_admin` 1명을 INSERT. 배포 후 1회 수동 실행.

## 경로 / API

| 경로 | 메서드 | 접근 | 설명 |
|---|---|---|---|
| `/admin/login` | 페이지 | 공개 | 로그인 폼 |
| `/admin` | 페이지 | 로그인 | 대시보드: 지표 + 유저 검색/정지 |
| `/admin/operators` | 페이지 | super_admin | 운영자 계정 관리 |
| `/api/admin/auth/login` | POST | 공개 | 로그인, 실패 카운트/잠금 처리 |
| `/api/admin/auth/logout` | POST | 로그인 | 쿠키 삭제 |
| `/api/admin/stats` | GET | 로그인 | 기존 `/api/stats`를 대체 (DAU/WAU/MAU) |
| `/api/admin/users` | GET | 로그인 | `?q=&limit=&offset=` 검색, limit 기본 20·최대 100 |
| `/api/admin/users/[userId]` | GET | 로그인 | 상세: 닉네임/가입일/리뷰수/현재 정지/이력 |
| `/api/admin/users/[userId]/suspend` | POST | 로그인 | `{ duration, reason }` |
| `/api/admin/users/[userId]/unsuspend` | POST | 로그인 | 해제 |
| `/api/admin/operators` | GET/POST | super_admin | 목록/생성 |
| `/api/admin/operators/[id]/deactivate` | POST | super_admin | 비활성화 |

`/api/stats`와 그걸 게이트하던 `ADMIN_USER_ID` 환경변수 분기는 삭제한다 —
쓰는 곳이 없는 걸 확인했다(grep 결과 0건).

**검색은 무조건 limit/offset을 요구한다.** 운영툴이라고 전체 스캔을 허용하면
유저가 늘었을 때 이 엔드포인트가 제일 먼저 느려진다.

## 정지 흐름

**정지 걸기 (`POST /api/admin/users/[userId]/suspend`):**
1. duration → `suspended_until` 계산 (`permanent`는 상수, 나머지는 `now() + interval`)
2. `UPDATE users SET suspended_until = ...`
3. `INSERT INTO user_suspensions (...)`
두 쓰기는 하나의 SQL 트랜잭션으로 묶는다(둘 다 성공하거나 둘 다 실패).

**해제 (`POST /api/admin/users/[userId]/unsuspend`):**
1. `UPDATE users SET suspended_until = NULL`
2. `UPDATE user_suspensions SET lifted_at = now(), lifted_by = $admin WHERE user_id = $userId AND lifted_at IS NULL AND suspended_until > now()`
같은 트랜잭션으로 묶어서 중간에 실패하면 "해제됐는데 이력엔 안 남는" 상태가
생기지 않게 한다.

## 정지 집행

`lib/suspension.ts`에 `isSuspended(userId): Promise<{ suspended: boolean; until: Date | null }>`
하나를 두고, 다음 세 지점에서만 부른다:

- `POST /api/reviews` (리뷰 작성)
- `PATCH /api/reviews/[id]` (리뷰 수정)
- `PUT /api/auth/nickname` (닉네임 변경)

막힐 때는 403 + `"정지된 계정입니다. {날짜}까지 글쓰기가 제한됩니다."`
(영구 정지는 날짜 대신 "영구 정지되었습니다.").
리뷰 삭제(DELETE)·저장·지도 열람은 건드리지 않는다.

## 안전장치

- 최고관리자는 **자기 자신을 비활성화할 수 없다** (`deactivate` 라우트에서
  `targetId === session.adminId`면 400).
- **마지막 super_admin은 비활성화할 수 없다** (`is_active = true AND role =
  'super_admin'` 카운트가 1일 때 그 계정을 끄려는 요청은 400).
- operator는 `/admin/operators`, `/api/admin/operators*`에 아예 접근 불가(403).

## 테스트

기존 `__tests__/*-route.test.ts` 패턴을 따른다:

- `admin-auth.test.ts` — scrypt 해시/검증, 포맷 파싱
- `admin-session.test.ts` — 토큰 서명/검증, 쿠키 옵션
- `admin-login-route.test.ts` — 성공/실패/5회 잠금/잠금 해제 후 재시도
- `admin-suspend-route.test.ts` — 기간별 `suspended_until` 계산, 트랜잭션 원자성,
  권한(operator가 operators API 치면 403)
- `suspension-enforcement.test.ts` — 정지 중 리뷰 작성/수정/닉네임 변경 403,
  삭제는 통과
