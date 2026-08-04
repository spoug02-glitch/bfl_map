import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function putNickname(nickname: unknown, opts: { authed: boolean } = { authed: true }) {
  const { PUT } = await import("@/app/api/auth/nickname/route");
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.authed) {
    headers.cookie = `${SESSION_COOKIE}=${await createSessionToken("kakao:1")}`;
  }
  return PUT(
    new NextRequest("http://localhost/api/auth/nickname", {
      method: "PUT",
      headers,
      body: JSON.stringify({ nickname }),
    }),
  );
}

describe("PUT /api/auth/nickname", () => {
  it("rejects an anonymous caller", async () => {
    const res = await putNickname("점심러4821", { authed: false });
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid nickname without touching the database", async () => {
    const res = await putNickname("점심 러");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "한글, 영문, 숫자, 밑줄만 쓸 수 있어요." });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects profanity", async () => {
    const res = await putNickname("씨발러");
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("upserts a valid nickname", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await putNickname("점심러4821");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러4821" });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });
});
