import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/admin-auth";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function login(body: unknown) {
  const { POST } = await import("@/app/api/admin/auth/login/route");
  const { NextRequest } = await import("next/server");
  return POST(
    new NextRequest("http://localhost/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/admin/auth/login", () => {
  it("rejects a missing username/password without touching the database", async () => {
    const res = await login({ username: "owner" });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown username", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await login({ username: "ghost", password: "whatever" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a deactivated account without checking the password", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock.mockResolvedValueOnce([
      { id: 1, password_hash: hash, role: "operator", is_active: false, failed_attempts: 0, locked_until: null },
    ]);
    const res = await login({ username: "ops", password: "correct-password" });
    expect(res.status).toBe(401);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("returns 423 while locked out, without verifying the password", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock.mockResolvedValueOnce([
      {
        id: 1, password_hash: hash, role: "operator", is_active: true,
        failed_attempts: 5, locked_until: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);
    const res = await login({ username: "ops", password: "correct-password" });
    expect(res.status).toBe(423);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("locks the account after the 5th consecutive failure", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock
      .mockResolvedValueOnce([
        { id: 1, password_hash: hash, role: "operator", is_active: true, failed_attempts: 4, locked_until: null },
      ])
      .mockResolvedValueOnce([]);
    const res = await login({ username: "ops", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(sqlMock).toHaveBeenCalledTimes(2);
    const updateCall = sqlMock.mock.calls[1][0].join("");
    expect(updateCall).toContain("UPDATE admin_users");
  });

  it("logs in successfully, resets the failure counter, and sets the admin cookie", async () => {
    const hash = await hashPassword("correct-password");
    sqlMock
      .mockResolvedValueOnce([
        { id: 42, password_hash: hash, role: "super_admin", is_active: true, failed_attempts: 2, locked_until: null },
      ])
      .mockResolvedValueOnce([]);
    const res = await login({ username: "owner", password: "correct-password" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, role: "super_admin" });
    expect(res.cookies.get("bfl_admin_session")?.value).toBeTruthy();
  });
});

describe("POST /api/admin/auth/logout", () => {
  it("clears the admin cookie", async () => {
    const { POST } = await import("@/app/api/admin/auth/logout/route");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(res.cookies.get("bfl_admin_session")?.value).toBe("");
  });
});
