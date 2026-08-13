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
