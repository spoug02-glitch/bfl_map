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
