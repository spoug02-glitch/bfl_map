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
