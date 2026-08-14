# 크롤링 실행 이력 조회 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `collect.py` 실행이 끝날 때마다 요약을 파일에 남기고, 어드민 대시보드에서 지난 실행들을 조회할 수 있게 한다.

**Architecture:** `collect.py`가 실행 요약(시각·범위·건수)을 `web/collector-runs.json`(JSON 배열, append)에 기록한다. 이 파일은 `restaurants.json`과 마찬가지로 개발자가 직접 커밋·푸시해야 배포에 반영된다 — 새 인프라나 자격증명은 추가하지 않는다. `GET /api/admin/crawl-runs`가 이 파일을 읽어 최신순으로 반환하고, `/admin` 대시보드에 목록 섹션을 하나 추가한다.

**Tech Stack:** Python 3(pytest), Next.js 16 App Router(TypeScript, vitest)

**Spec:** `Bfl_map/docs/specs/2026-08-14-crawl-run-history-design.md`

## Global Constraints

- 이력 파일은 **`web/` 안**(`web/collector-runs.json`, `public/` 아님)에 둔다 — Vercel 배포가 `Bfl_map/web/` 서브트리만 분리해서 올라가기 때문에 `collector/` 안에 두면 어드민이 절대 못 읽는다. `public/`에 두지 않는 이유는 정적 파일이라 인증 없이 노출되기 때문(이미 `restaurants.json`에서 겪은 문제).
- `collect.py` 쪽 이력 기록 실패(파일 쓰기 권한 등)는 **크롤링 실행 자체를 실패시키지 않는다** — stderr 경고만 남기고 계속한다.
- `--limit`/`--skip-menus` 같은 스모크 테스트 실행도 구분 없이 똑같이 한 항목으로 남는다.
- `GET /api/admin/crawl-runs`는 `requireAdmin`만 걸고 `requireRole`은 지정하지 않는다 — 운영자·최고관리자 모두 볼 수 있다(기존 `/api/admin/stats`와 동일한 접근 정책).
- 새 npm/pip 의존성을 추가하지 않는다.
- 모든 API 에러 응답은 `{ "error": "<한국어 문장>" }` 형태를 유지한다(기존 관례).
- 작업 디렉터리는 `Bfl_map/collector/`(Task 1)와 `Bfl_map/web/`(Task 2, 3). 명령은 그 안에서 실행한다.

---

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `web/app/api/admin/crawl-runs/route.ts` | `collector-runs.json`을 읽어 최신순으로 반환 |
| `web/__tests__/admin-crawl-runs-route.test.ts` | 위 라우트 테스트 |

**수정**

| 파일 | 변경 |
|---|---|
| `collector/collect.py` | `main()`이 실행 요약을 `web/collector-runs.json`에 append |
| `collector/tests/test_collect.py` | 이력 append 함수 테스트 추가 |
| `web/components/admin/AdminDashboard.tsx` | "크롤링 이력" 섹션 추가 |

---

### Task 1: `collect.py` 실행 이력 기록

**Files:**
- Modify: `collector/collect.py`
- Test: `collector/tests/test_collect.py`

**Interfaces:**
- Produces:
  - `HISTORY_PATH: Path` — `web/collector-runs.json`을 가리키는 모듈 상수
  - `_append_run_history(path: Path, record: dict) -> None` — 파일에 항목을 append. 쓰기 실패 시 예외를 던지지 않고 stderr에 경고를 출력한다.

- [ ] **Step 1: Write the failing test**

`collector/tests/test_collect.py` 끝에 추가:

```python
# --- run history --------------------------------------------------------

def test_append_run_history_creates_file_with_one_record(tmp_path):
    path = tmp_path / "collector-runs.json"
    record = {"startedAt": "2026-08-14T00:00:00Z", "finishedAt": "2026-08-14T00:01:00Z",
               "districts": ["도봉구"], "codes": ["56191"],
               "crawled": 3, "matched": 2, "unresolved": 1, "outOfRadius": 0, "duplicates": 0}
    collect._append_run_history(path, record)
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved == [record]


def test_append_run_history_appends_to_existing_records(tmp_path):
    path = tmp_path / "collector-runs.json"
    first = {"startedAt": "2026-08-13T00:00:00Z", "finishedAt": "2026-08-13T00:01:00Z",
              "districts": ["노원구"], "codes": ["56191"],
              "crawled": 1, "matched": 1, "unresolved": 0, "outOfRadius": 0, "duplicates": 0}
    path.write_text(json.dumps([first], ensure_ascii=False), encoding="utf-8")
    second = {"startedAt": "2026-08-14T00:00:00Z", "finishedAt": "2026-08-14T00:01:00Z",
               "districts": ["강북구"], "codes": ["56221"],
               "crawled": 5, "matched": 4, "unresolved": 1, "outOfRadius": 0, "duplicates": 0}
    collect._append_run_history(path, second)
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved == [first, second]


def test_append_run_history_does_not_raise_on_write_failure(tmp_path, capsys):
    # path is a directory, not a file -- write_text must fail, but the crawl
    # itself must not be aborted over a history-logging problem
    directory_as_path = tmp_path
    record = {"startedAt": "x", "finishedAt": "y", "districts": [], "codes": [],
               "crawled": 0, "matched": 0, "unresolved": 0, "outOfRadius": 0, "duplicates": 0}
    collect._append_run_history(directory_as_path, record)  # must not raise
    assert "[history]" in capsys.readouterr().out
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/collector && python -m pytest tests/test_collect.py -k append_run_history -v`
Expected: FAIL — `AttributeError: module 'collect' has no attribute '_append_run_history'`

- [ ] **Step 3: Write minimal implementation**

`collector/collect.py` 상단 import 블록(현재 `import argparse` ~ `import zeropay`) 바로 뒤, `CENTER_LAT` 정의 전에 추가:

```python
from datetime import datetime, timezone
```

기존:
```python
CENTER_LAT, CENTER_LNG = 37.6545, 127.0499  # 창동씨드큐브
RADIUS_KM = 5.0
OUT_PATH = Path(__file__).resolve().parent.parent / "web" / "public" / "restaurants.json"
UNRESOLVED_PATH = Path(__file__).resolve().parent / "unresolved.json"
OUT_OF_RADIUS_PATH = Path(__file__).resolve().parent / "out_of_radius.json"
CHECKPOINT_PATH = Path(__file__).resolve().parent / ".checkpoint.jsonl"
DISTRICTS = ["도봉구", "노원구", "강북구"]
```
바로 뒤에 추가:
```python
# Vercel 배포는 web/ 서브트리만 분리해서 올라간다(collector/는 배포 결과물에
# 없음) — 그래서 어드민이 읽을 이력은 web/ 안에 둔다. public/은 아니다: 정적
# 파일은 인증 없이 그대로 노출된다(restaurants.json이 겪은 문제와 같다).
HISTORY_PATH = Path(__file__).resolve().parent.parent / "web" / "collector-runs.json"
```

파일 끝, `if __name__ == "__main__":` 앞에 추가:

```python
def _append_run_history(path: Path, record: dict) -> None:
    """실행 요약 한 건을 JSON 배열에 append한다.

    데이터 수집이 이력 기록보다 중요하다 — 쓰기 실패(권한 등)로 몇 시간짜리
    크롤링 결과를 날릴 수는 없으므로 예외를 삼키고 경고만 남긴다.
    """
    try:
        history = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        history.append(record)
        path.write_text(json.dumps(history, ensure_ascii=False, indent=1), encoding="utf-8")
    except OSError as e:
        print(f"[history] failed to record run history: {e}", flush=True)
```

`main()` 안, 기존:
```python
def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
```
을:
```python
def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    started_at = datetime.now(timezone.utc).isoformat()
    ap = argparse.ArgumentParser()
```
로 바꾼다.

`main()` 끝부분, 기존:
```python
    if a + b + c + d != n:
        # A resumed run counts merchants restored from the checkpoint as repeats,
        # so this only balances on an uninterrupted run. Say so instead of
        # printing a bare False that reads like data loss.
        print("[done] note: totals only balance on an uninterrupted run — a resume "
              "re-encounters already-processed merchants and counts them as duplicates",
              flush=True)
    # the run finished, so the resume log has served its purpose
    CHECKPOINT_PATH.unlink(missing_ok=True)
```
바로 뒤(같은 `main()` 안, 함수 끝)에 추가:
```python
    _append_run_history(HISTORY_PATH, {
        "startedAt": started_at,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "districts": args.districts.split(","),
        "codes": args.codes.split(","),
        "crawled": n,
        "matched": a,
        "unresolved": b,
        "outOfRadius": c,
        "duplicates": d,
    })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/collector && python -m pytest tests/test_collect.py -v`
Expected: PASS (기존 테스트 전부 + 신규 3개, 총 20개)

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin add Bfl_map/collector/collect.py Bfl_map/collector/tests/test_collect.py
git -C C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin commit -m "feat(bfl-map): record collect.py run summaries to web/collector-runs.json"
```
(`C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin`는 `Bfl_map`의 상위 디렉터리 — `git -C` 형태를 반드시 쓴다. 이 저장소엔 커밋을 가로채는 PreToolUse 훅이 있는데, `cd && git commit` 형태로는 훅이 대상 경로를 못 찾아 "staged 변경이 없습니다"로 거부한다.)

---

### Task 2: `GET /api/admin/crawl-runs`

**Files:**
- Create: `web/app/api/admin/crawl-runs/route.ts`
- Test: `web/__tests__/admin-crawl-runs-route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/admin-session`)
- Produces: `GET /api/admin/crawl-runs` → `{ runs: CrawlRun[] }`, 최신(`startedAt` 내림차순) 순. 파일이 없으면 `{ runs: [] }`.
  - `type CrawlRun = { startedAt: string; finishedAt: string; districts: string[]; codes: string[]; crawled: number; matched: number; unresolved: number; outOfRadius: number; duplicates: number }`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/admin-crawl-runs-route.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: readFileMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  readFileMock.mockReset();
});

async function call(token?: string) {
  const { GET } = await import("@/app/api/admin/crawl-runs/route");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `bfl_admin_session=${token}`;
  return GET(new NextRequest("http://localhost/api/admin/crawl-runs", { headers }));
}

describe("GET /api/admin/crawl-runs", () => {
  it("requires an admin session", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("returns an empty list when the history file doesn't exist", async () => {
    const { createAdminSessionToken } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(1, "operator");
    readFileMock.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOENT" }));
    const res = await call(token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runs: [] });
  });

  it("returns runs sorted newest-first", async () => {
    const { createAdminSessionToken } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(1, "operator");
    const older = { startedAt: "2026-08-13T00:00:00Z", finishedAt: "2026-08-13T01:00:00Z",
      districts: ["노원구"], codes: ["56191"], crawled: 1, matched: 1, unresolved: 0, outOfRadius: 0, duplicates: 0 };
    const newer = { startedAt: "2026-08-14T00:00:00Z", finishedAt: "2026-08-14T03:00:00Z",
      districts: ["도봉구"], codes: ["56191"], crawled: 2, matched: 2, unresolved: 0, outOfRadius: 0, duplicates: 0 };
    readFileMock.mockResolvedValueOnce(JSON.stringify([older, newer]));
    const res = await call(token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs.map((r: { startedAt: string }) => r.startedAt)).toEqual([newer.startedAt, older.startedAt]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Bfl_map/web && npm test -- admin-crawl-runs-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/admin/crawl-runs/route"`

- [ ] **Step 3: Write minimal implementation**

Create `web/app/api/admin/crawl-runs/route.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";

type CrawlRun = {
  startedAt: string;
  finishedAt: string;
  districts: string[];
  codes: string[];
  crawled: number;
  matched: number;
  unresolved: number;
  outOfRadius: number;
  duplicates: number;
};

const HISTORY_PATH = path.join(process.cwd(), "collector-runs.json");

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;

  let runs: CrawlRun[] = [];
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    runs = JSON.parse(raw) as CrawlRun[];
  } catch {
    runs = [];
  }
  runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));

  return NextResponse.json({ runs });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Bfl_map/web && npm test -- admin-crawl-runs-route.test.ts`
Expected: PASS (3개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git -C C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin add Bfl_map/web/app/api/admin/crawl-runs Bfl_map/web/__tests__/admin-crawl-runs-route.test.ts
git -C C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin commit -m "feat(bfl-map): add GET /api/admin/crawl-runs"
```

---

### Task 3: 어드민 대시보드 "크롤링 이력" 섹션

**Files:**
- Modify: `web/components/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/crawl-runs` (Task 2)

- [ ] **Step 1: 타입과 상태 추가**

`web/components/admin/AdminDashboard.tsx` 상단, 기존 `type Stats = { dau: number; wau: number; mau: number };` 바로 뒤에 추가:

```ts
type CrawlRun = {
  startedAt: string;
  finishedAt: string;
  districts: string[];
  codes: string[];
  crawled: number;
  matched: number;
  unresolved: number;
  outOfRadius: number;
  duplicates: number;
};
```

`AdminDashboard` 함수 본문, 기존:
```ts
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
```
사이에 추가:
```ts
  const [stats, setStats] = useState<Stats | null>(null);
  const [crawlRuns, setCrawlRuns] = useState<CrawlRun[]>([]);
  const [query, setQuery] = useState("");
```

기존:
```ts
  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(setStats);
  }, []);
```
바로 뒤에 추가:
```ts
  useEffect(() => {
    fetch("/api/admin/crawl-runs").then(r => r.json()).then(d => setCrawlRuns(d.runs ?? []));
  }, []);
```

- [ ] **Step 2: 화면에 섹션 렌더**

기존:
```tsx
      {stats && (
        <p className="mt-4 rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-medium text-text-primary">
          DAU {stats.dau} · WAU {stats.wau} · MAU {stats.mau}
        </p>
      )}

      <div className="mt-6">
        <input
```
를:
```tsx
      {stats && (
        <p className="mt-4 rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-medium text-text-primary">
          DAU {stats.dau} · WAU {stats.wau} · MAU {stats.mau}
        </p>
      )}

      {crawlRuns.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-text-primary">크롤링 이력</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">실행 시각</th>
                  <th className="px-3 py-2 font-medium">지역</th>
                  <th className="px-3 py-2 font-medium">수집/매칭/미해결/반경밖/중복</th>
                </tr>
              </thead>
              <tbody>
                {crawlRuns.slice(0, 20).map(run => (
                  <tr key={run.startedAt} className="border-t border-border-subtle">
                    <td className="px-3 py-2 text-text-primary">
                      {run.startedAt.slice(0, 16).replace("T", " ")} ~ {run.finishedAt.slice(11, 16)}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{run.districts.join(", ")}</td>
                    <td className="px-3 py-2 text-text-muted">
                      {run.crawled}/{run.matched}/{run.unresolved}/{run.outOfRadius}/{run.duplicates}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <input
```
로 바꾼다.

- [ ] **Step 3: 타입 체크 + 전체 테스트**

Run: `cd Bfl_map/web && npx tsc --noEmit && npm test`
Expected: 타입 에러 없음, 전체 테스트 PASS.

- [ ] **Step 4: Commit**

```bash
git -C C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin add Bfl_map/web/components/admin/AdminDashboard.tsx
git -C C:/Users/notebook/Desktop/Apps/.claude/worktrees/feature-bfl-map-admin commit -m "feat(bfl-map): show crawl run history in admin dashboard"
```

---

## Self-Review 메모

- **스펙 커버리지:** 실행 요약 기록(Task 1), 어드민 조회 API(Task 2), 대시보드 목록(Task 3) — 스펙의 세 항목 모두 태스크로 연결됨. "원격 트리거·unresolved 상세·brands.py 편집은 범위 밖"이라는 스펙의 제외 항목은 어떤 태스크에도 포함되지 않음(의도대로).
- **배포 구조 제약:** `HISTORY_PATH`가 `web/` 안(`public/` 아님)인지 Task 1 코드에서 재확인함 — 스펙의 핵심 제약과 일치.
- **타입 일관성:** `CrawlRun` 타입(필드명·타입)이 Task 2(API 응답)와 Task 3(프론트 소비)에서 동일함을 재확인함.
- **실패 격리:** Task 1의 `_append_run_history`는 `OSError`만 잡는다 — `json.loads`가 손상된 파일 때문에 `json.JSONDecodeError`를 던지는 경우는 잡지 않는데, 이건 의도적이다. 손상된 이력 파일은 사람이 봐야 하는 진짜 버그이지 조용히 넘어갈 상황이 아니다(체크포인트 파일과 달리 이력 파일은 크게 자라지 않고 매번 통째로 다시 쓰므로 부분 손상 시나리오도 없다).
