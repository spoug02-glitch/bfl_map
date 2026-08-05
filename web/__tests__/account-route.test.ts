import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
  sqlMock.mockResolvedValue([]);
});

async function withdraw(authed = true) {
  const { DELETE } = await import("@/app/api/account/route");
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = {};
  if (authed) headers.cookie = `${SESSION_COOKIE}=${await createSessionToken("kakao:leaver")}`;
  return DELETE(new NextRequest("http://localhost/api/account", { method: "DELETE", headers }));
}

/** 태그드 템플릿의 첫 조각들을 이어 붙여 어떤 문장이었는지 본다. */
function statementOf(callIndex: number): string {
  const strings = sqlMock.mock.calls[callIndex][0] as unknown as string[];
  return strings.join("?").replace(/\s+/g, " ").trim();
}

describe("DELETE /api/account", () => {
  it("rejects an anonymous caller without deleting anything", async () => {
    const res = await withdraw(false);
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("deletes the account and everything hanging off it", async () => {
    const res = await withdraw();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sqlMock).toHaveBeenCalledTimes(3);
  });

  // users를 먼저 지우면 외래 키가 걸려 통째로 실패한다.
  it("clears the referencing rows before the user row", async () => {
    await withdraw();
    expect(statementOf(0)).toContain("saved_places");
    expect(statementOf(1)).toContain("reviews");
    expect(statementOf(2)).toContain("users");
  });

  it("ends the session so a deleted account keeps no cookie", async () => {
    const res = await withdraw();
    const cookie = res.cookies.get("bfl_session");
    // 삭제는 만료된 빈 쿠키로 표현된다
    expect(cookie?.value).toBe("");
  });
});
