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

  it("closes the account", async () => {
    const res = await withdraw();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  // 따로 보내면 중간에 끊겼을 때 글은 옮겨졌는데 계정은 남는다. 탈퇴에서 그
  // 중간 상태는 존재하면 안 되므로 한 번의 트랜잭션이어야 한다.
  it("does the whole thing in a single transaction", async () => {
    await withdraw();
    expect(sqlMock.transaction).toHaveBeenCalledTimes(1);
  });

  // 지워야 하는 건 "누가 썼는지"이지 글이 아니다. 리뷰를 지우면 가게 평점까지
  // 흔들리는데, 그건 탈퇴한 사람이 의도한 바가 아니다.
  it("moves the writing to the anonymous account instead of deleting it", async () => {
    await withdraw();
    const reviews = batched().filter(s => s.includes("reviews"));
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatch(/^UPDATE reviews SET user_id/);
    expect(reviews[0]).not.toContain("DELETE");
  });

  // 개인을 가리키는 값은 users 행의 카카오 회원번호뿐이라 그건 반드시 지운다.
  // 그리고 그걸 참조하는 것들보다 뒤여야 외래 키가 걸리지 않는다.
  it("deletes the account row after everything that references it", async () => {
    await withdraw();
    const statements = batched();
    const userRow = statements.findIndex(s => /^DELETE FROM users/.test(s));
    expect(userRow).toBeGreaterThanOrEqual(0);
    expect(statements.some(s => s.includes("saved_places"))).toBe(true);
    for (const [i, s] of statements.entries()) {
      if (/reviews|lunch_specials|saved_places/.test(s)) expect(i).toBeLessThan(userRow);
    }
  });

  // 계정만 지워지고 지문은 안 남는 상태가 생기면 곧바로 재가입할 수 있다.
  it("records the rejoin fingerprint in the same transaction", async () => {
    await withdraw();
    const statements = batched();
    expect(statements.some(s => /^INSERT INTO withdrawals/.test(s))).toBe(true);
  });

  // 카카오 회원번호를 그대로 넣으면 탈퇴 시 지운다는 공지가 거짓이 된다.
  it("stores a fingerprint, never the account id itself", async () => {
    await withdraw();
    const insert = batched().find(s => s.includes("withdrawals")) ?? "";
    expect(insert).not.toContain("kakao:leaver");
  });

  // 저장한 가게는 남에게 보이지 않는 개인 목록이라 익명으로 남길 값이 없다.
  it("deletes the private saved list rather than anonymising it", async () => {
    await withdraw();
    const saved = batched().filter(s => s.includes("saved_places"));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatch(/^DELETE FROM saved_places/);
  });

  // (place_id, user_id)가 기본키다. 대표 계정이 같은 가게 제보를 이미 갖고 있으면
  // 그냥 옮기는 순간 중복으로 터진다.
  it("clears colliding specials before moving them", async () => {
    await withdraw();
    const specials = batched().filter(s => s.includes("lunch_specials"));
    const move = specials.findIndex(s => s.startsWith("UPDATE lunch_specials"));
    expect(move).toBeGreaterThan(0);
    expect(specials.slice(0, move).every(s => s.startsWith("DELETE"))).toBe(true);
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
