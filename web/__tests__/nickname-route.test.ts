import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** A users row as the route reads it. `renamed` false means the nickname was set once and never changed. */
function userRow({ nickname, renamed, agoDays }: { nickname: string; renamed: boolean; agoDays: number }) {
  const updated = new Date(Date.now() - agoDays * DAY_MS);
  const created = renamed ? new Date(updated.getTime() - 100 * DAY_MS) : updated;
  return { nickname, created_at: created.toISOString(), updated_at: updated.toISOString() };
}

function uniqueViolation() {
  return Object.assign(new Error('duplicate key value violates unique constraint "users_nickname_lower_key"'), {
    code: "23505",
  });
}

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

  it("accepts the first nickname a new account picks", async () => {
    sqlMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러482913" });
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("treats resubmitting the current nickname as a no-op instead of a rename", async () => {
    // Otherwise a double-click on 확인 would burn the user's one free rename.
    sqlMock.mockResolvedValueOnce([userRow({ nickname: "점심러482913", renamed: true, agoDays: 0 })]);
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nickname: "점심러482913" });
    expect(sqlMock).toHaveBeenCalledTimes(1); // no write
  });

  it("allows the first rename even if the name was set moments ago", async () => {
    // People accept the auto-suggested name, then think better of it. Locking
    // them out for a month over that would be punishing the wrong behaviour.
    sqlMock
      .mockResolvedValueOnce([userRow({ nickname: "점심러482913", renamed: false, agoDays: 0 })])
      .mockResolvedValueOnce([]);
    const res = await putNickname("돈까스러버");
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("blocks a second rename inside the 30 day window and names the date", async () => {
    sqlMock.mockResolvedValueOnce([userRow({ nickname: "돈까스러버", renamed: true, agoDays: 3 })]);
    const res = await putNickname("국밥러버");
    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toContain("30일에 한 번");
    const expected = new Date(Date.now() + 27 * DAY_MS + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(error).toContain(expected);
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the write
  });

  it("allows a rename once the 30 day window has passed", async () => {
    sqlMock
      .mockResolvedValueOnce([userRow({ nickname: "돈까스러버", renamed: true, agoDays: 31 })])
      .mockResolvedValueOnce([]);
    const res = await putNickname("국밥러버");
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("reports a nickname already taken by someone else as 409", async () => {
    sqlMock.mockResolvedValueOnce([]).mockRejectedValueOnce(uniqueViolation());
    const res = await putNickname("점심러482913");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "이미 사용 중인 닉네임이에요." });
  });

  it("does not swallow an unrelated database failure", async () => {
    sqlMock.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("connection reset"));
    await expect(putNickname("점심러482913")).rejects.toThrow("connection reset");
  });
});
