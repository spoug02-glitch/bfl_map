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
