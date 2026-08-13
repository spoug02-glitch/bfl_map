import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock, transactionMock } = vi.hoisted(() => ({ sqlMock: vi.fn(), transactionMock: vi.fn() }));
(sqlMock as unknown as { transaction: typeof transactionMock }).transaction = transactionMock;
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
  it("rejects an invalid duration with only the is_active check", async () => {
    sqlMock.mockResolvedValueOnce([{ is_active: true }]); // requireAdmin is_active check
    const res = await call("suspend", "kakao:1", { duration: "2h", reason: "abuse" });
    expect(res.status).toBe(400);
    expect(sqlMock).toHaveBeenCalledTimes(1); // only is_active check, no further db calls
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects an empty reason with only the is_active check", async () => {
    sqlMock.mockResolvedValueOnce([{ is_active: true }]); // requireAdmin is_active check
    const res = await call("suspend", "kakao:1", { duration: "1d", reason: "  " });
    expect(res.status).toBe(400);
    expect(sqlMock).toHaveBeenCalledTimes(1); // only is_active check, no further db calls
  });

  it("returns 404 when the target user doesn't exist", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([]); // user lookup
    const res = await call("suspend", "kakao:ghost", { duration: "1d", reason: "abuse" });
    expect(res.status).toBe(404);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("writes both tables in one transaction and returns the expiry", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([{ user_id: "kakao:1" }]); // user lookup
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
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([]); // user lookup
    const res = await call("unsuspend", "kakao:ghost");
    expect(res.status).toBe(404);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("clears the suspension and lifts the open history row in one transaction", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }]) // requireAdmin is_active check
      .mockResolvedValueOnce([{ user_id: "kakao:1" }]); // user lookup
    const res = await call("unsuspend", "kakao:1");
    expect(res.status).toBe(200);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2);
  });
});
