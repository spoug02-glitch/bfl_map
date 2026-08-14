import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));
const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));

vi.mock("node:fs/promises", () => ({ readFile: readFileMock }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost/test";
});

beforeEach(() => {
  readFileMock.mockReset();
  sqlMock.mockReset();
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
    sqlMock.mockResolvedValueOnce([{ is_active: true }]);
    readFileMock.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOENT" }));
    const res = await call(token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runs: [] });
  });

  it("returns runs sorted newest-first", async () => {
    const { createAdminSessionToken } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(1, "operator");
    sqlMock.mockResolvedValueOnce([{ is_active: true }]);
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
