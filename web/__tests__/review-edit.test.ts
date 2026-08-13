import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

const validBody = { taste: 4, convenience: 2, body: "고쳐 씀" };

async function call(
  method: "PATCH" | "DELETE",
  id: string,
  opts: { authed?: boolean; body?: unknown } = {},
) {
  const mod = await import("@/app/api/reviews/[id]/route");
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.authed !== false) {
    headers.cookie = `${SESSION_COOKIE}=${await createSessionToken("kakao:owner")}`;
  }
  const req = new NextRequest(`http://localhost/api/reviews/${id}`, {
    method,
    headers,
    ...(method === "PATCH" ? { body: JSON.stringify(opts.body ?? validBody) } : {}),
  });
  const params = { params: Promise.resolve({ id }) };
  // 두 핸들러를 유니온으로 묶어 호출하면 반환 타입이 뭉개진다 — 분기해서 부른다.
  return method === "PATCH" ? mod.PATCH(req, params) : mod.DELETE(req, params);
}

describe("PATCH /api/reviews/[id]", () => {
  it("rejects an anonymous caller", async () => {
    const res = await call("PATCH", "7", { authed: false });
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid body without touching the database", async () => {
    const res = await call("PATCH", "7", { body: { ...validBody, taste: 9 } });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects profanity", async () => {
    const res = await call("PATCH", "7", { body: { ...validBody, body: "씨발 맛없어" } });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("updates the caller's own review", async () => {
    sqlMock.mockResolvedValueOnce([{ id: 7 }]);
    const res = await call("PATCH", "7");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  // 소유권은 WHERE 절이 판정한다 — 남의 리뷰면 갱신된 행이 0개로 돌아온다.
  it("reports someone else's review as not found rather than forbidden", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await call("PATCH", "7");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "찾을 수 없습니다." });
  });

  it.each(["abc", "1;DROP", "", "-1", "1.5"])("rejects the malformed id %j", async (id) => {
    const res = await call("PATCH", id);
    expect(res.status).toBe(404);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/reviews/[id]", () => {
  it("rejects an anonymous caller", async () => {
    const res = await call("DELETE", "7", { authed: false });
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("deletes the caller's own review", async () => {
    sqlMock.mockResolvedValueOnce([{ id: 7 }]);
    const res = await call("DELETE", "7");
    expect(res.status).toBe(200);
  });

  it("reports someone else's review as not found", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await call("DELETE", "7");
    expect(res.status).toBe(404);
  });
});
