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
    sqlMock.mockResolvedValueOnce([{ is_active: true }]); // requireAdmin is_active check
    const res = await mod.GET(new NextRequest("http://localhost/api/admin/operators", { headers: { cookie: `bfl_admin_session=${token}` } }));
    expect(res.status).toBe(403);
  });

  it("lists operators for a super_admin", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin");
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([{ id: 1, username: "owner", role: "super_admin", is_active: true, created_at: "2026-01-01" }]); // operators list
    const res = await mod.GET(new NextRequest("http://localhost/api/admin/operators", { headers: { cookie: `bfl_admin_session=${token}` } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.operators).toHaveLength(1);
  });

  it("rejects a short username with only the is_active check", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin");
    sqlMock.mockResolvedValueOnce([{ is_active: true }]); // requireAdmin is_active check
    const res = await mod.POST(
      new NextRequest("http://localhost/api/admin/operators", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `bfl_admin_session=${token}` },
        body: JSON.stringify({ username: "ab", password: "longenough1", role: "operator" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(sqlMock).toHaveBeenCalledTimes(1); // only is_active check, no further db calls
  });

  it("creates an operator account", async () => {
    const mod = await import("@/app/api/admin/operators/route");
    const { NextRequest } = await import("next/server");
    const token = await tokenFor("super_admin", 1);
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([{ id: 2 }]); // insert new operator
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
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" })); // insert duplicate
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

  it("refuses to deactivate yourself with only the is_active check", async () => {
    sqlMock.mockResolvedValueOnce([{ is_active: true }]); // requireAdmin is_active check
    const res = await call("1", 1);
    expect(res.status).toBe(400);
    expect(sqlMock).toHaveBeenCalledTimes(1); // only is_active check, no further db calls
  });

  it("refuses to deactivate the last active super_admin", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([{ role: "super_admin", is_active: true }]) // target admin lookup
      .mockResolvedValueOnce([{ count: 1 }]); // count active super_admins
    const res = await call("2", 1);
    expect(res.status).toBe(400);
  });

  it("deactivates an operator", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([{ role: "operator", is_active: true }]) // target admin lookup
      .mockResolvedValueOnce([]); // deactivate update
    const res = await call("2", 1);
    expect(res.status).toBe(200);
  });

  it("deactivates a super_admin when not the last one", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([{ role: "super_admin", is_active: true }]) // target admin lookup
      .mockResolvedValueOnce([{ count: 2 }]) // count active super_admins
      .mockResolvedValueOnce([]); // deactivate update
    const res = await call("3", 1);
    expect(res.status).toBe(200);
  });
});
