import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// 태그드 템플릿 호출은 "어떤 문장인지"만 기록해 두고, 실제 실행은 transaction이 받는다.
const { sqlMock } = vi.hoisted(() => {
  const fn = vi.fn((strings: TemplateStringsArray) => ({
    statement: strings.join("?").replace(/\s+/g, " ").trim(),
  }));
  return { sqlMock: Object.assign(fn, { transaction: vi.fn().mockResolvedValue([]) }) };
});
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockClear();
  sqlMock.transaction.mockClear();
  sqlMock.transaction.mockResolvedValue([]);
});

async function withdraw(authed = true) {
  const { DELETE } = await import("@/app/api/account/route");
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = {};
  if (authed) headers.cookie = `${SESSION_COOKIE}=${await createSessionToken("kakao:leaver")}`;
  return DELETE(new NextRequest("http://localhost/api/account", { method: "DELETE", headers }));
}

/** transaction에 넘어간 문장들 */
function batched(): string[] {
  const arg = sqlMock.transaction.mock.calls[0][0] as { statement: string }[];
  return arg.map(q => q.statement);
}

describe("DELETE /api/account", () => {
  it("rejects an anonymous caller without deleting anything", async () => {
    const res = await withdraw(false);
    expect(res.status).toBe(401);
    expect(sqlMock.transaction).not.toHaveBeenCalled();
  });

  it("deletes the account and everything hanging off it", async () => {
    const res = await withdraw();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  // 따로 보내면 중간에 끊겼을 때 리뷰만 사라지고 계정은 남는다. 탈퇴에서 그
  // 중간 상태는 존재하면 안 되므로 한 번의 트랜잭션이어야 한다.
  it("removes everything in a single transaction", async () => {
    await withdraw();
    expect(sqlMock.transaction).toHaveBeenCalledTimes(1);
    expect(batched()).toHaveLength(4);
  });

  // users를 먼저 지우면 외래 키가 걸려 통째로 실패한다.
  it("clears the referencing rows before the user row", async () => {
    await withdraw();
    const [first, second, third, fourth] = batched();
    expect(first).toContain("saved_places");
    expect(second).toContain("reviews");
    expect(third).toContain("lunch_specials");
    expect(fourth).toContain("users");
  });

  it("ends the session so a deleted account keeps no cookie", async () => {
    const res = await withdraw();
    const cookie = res.cookies.get("bfl_session");
    // 삭제는 만료된 빈 쿠키로 표현된다
    expect(cookie?.value).toBe("");
  });

  it("does not end the session when the delete fails", async () => {
    // 실패했는데 로그아웃까지 되면, 사용자는 지워진 줄 알고 떠난다.
    sqlMock.transaction.mockRejectedValueOnce(new Error("connection reset"));
    await expect(withdraw()).rejects.toThrow("connection reset");
  });
});
