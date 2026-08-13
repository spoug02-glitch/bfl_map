import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  sqlMock.mockReset();
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
    sqlMock.mockResolvedValueOnce([{ is_active: true }]);
    const ctx = await requireAdmin(await reqWithCookie(token));
    expect(ctx).toEqual({ ok: true, session: { adminId: 3, role: "operator" } });
  });

  it("returns 403 when an operator hits a super_admin-only route", async () => {
    const { createAdminSessionToken, requireAdmin } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(3, "operator");
    sqlMock.mockResolvedValueOnce([{ is_active: true }]);
    const ctx = await requireAdmin(await reqWithCookie(token), { requireRole: "super_admin" });
    if (ctx.ok) throw new Error("expected ok:false");
    expect(ctx.response.status).toBe(403);
  });

  it("passes a super_admin through a super_admin-only route", async () => {
    const { createAdminSessionToken, requireAdmin } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(9, "super_admin");
    sqlMock.mockResolvedValueOnce([{ is_active: true }]);
    const ctx = await requireAdmin(await reqWithCookie(token), { requireRole: "super_admin" });
    expect(ctx).toEqual({ ok: true, session: { adminId: 9, role: "super_admin" } });
  });

  it("returns 401 when admin is deactivated in the DB", async () => {
    const { createAdminSessionToken, requireAdmin } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(5, "operator");
    sqlMock.mockResolvedValueOnce([{ is_active: false }]);
    const ctx = await requireAdmin(await reqWithCookie(token));
    if (ctx.ok) throw new Error("expected ok:false");
    expect(ctx.response.status).toBe(401);
  });

  it("returns 401 when admin row is missing in the DB", async () => {
    const { createAdminSessionToken, requireAdmin } = await import("@/lib/admin-session");
    const token = await createAdminSessionToken(99, "operator");
    sqlMock.mockResolvedValueOnce([]);
    const ctx = await requireAdmin(await reqWithCookie(token));
    if (ctx.ok) throw new Error("expected ok:false");
    expect(ctx.response.status).toBe(401);
  });
});
