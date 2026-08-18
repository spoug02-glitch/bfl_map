import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-admin-secret-at-least-32-chars!!";
});
beforeEach(() => sqlMock.mockReset());

async function token() {
  const { createAdminSessionToken } = await import("@/lib/admin-session");
  return createAdminSessionToken(1, "operator");
}

async function call(method: "GET" | "PATCH", body?: unknown, tok?: string) {
  const mod = await import("@/app/api/admin/intake/route");
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (tok) headers.cookie = `bfl_admin_session=${tok}`;
  const req = new NextRequest("http://localhost/api/admin/intake", {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return method === "GET" ? mod.GET(req) : mod.PATCH(req);
}

function lastSql(): string {
  const s = sqlMock.mock.calls.at(-1)?.[0] as TemplateStringsArray;
  return s.join("?").replace(/\s+/g, " ");
}

describe("GET /api/admin/intake", () => {
  it("로그인 없이는 401 이고 DB 를 건드리지 않는다", async () => {
    const res = await call("GET");
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("열린 제보와 대기 업주 메뉴를 함께 준다", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }])
      .mockResolvedValueOnce([{ id: 1, kind: "place_fix", body: "폐업" }])
      .mockResolvedValueOnce([{ place_id: "9", item_count: 2, items: [] }]);
    const res = await call("GET", undefined, await token());
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.reports).toHaveLength(1);
    expect(b.ownerMenus[0].place_id).toBe("9");
  });

  it("처리된 건은 목록에 넣지 않는다", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await call("GET", undefined, await token());
    const queries = sqlMock.mock.calls
      .slice(1)
      .map(c => (c[0] as TemplateStringsArray).join("?").replace(/\s+/g, " "));
    expect(queries[0]).toContain("status = 'open'");
    expect(queries[1]).toContain("status = 'pending'");
    // 출처로 좁히지 않는다 — 좁히면 운영자가 전사한 user_report 가 검토 화면에
    // 뜨지 않아 영원히 pending 으로 남는다.
    expect(queries[1]).not.toContain("source_type = 'owner'");
  });
});

describe("PATCH /api/admin/intake", () => {
  it("로그인 없이는 401", async () => {
    const res = await call("PATCH", { target: "report", decision: "approve", id: 1 });
    expect(res.status).toBe(401);
  });

  it("모양이 틀리면 400", async () => {
    sqlMock.mockResolvedValueOnce([{ is_active: true }]);
    const res = await call("PATCH", { target: "nope", decision: "approve" }, await token());
    expect(res.status).toBe(400);
  });

  it("제보를 처리하면 처리자와 시각을 남긴다", async () => {
    sqlMock.mockResolvedValueOnce([{ is_active: true }]).mockResolvedValueOnce([{ id: 7 }]);
    const res = await call("PATCH", { target: "report", decision: "approve", id: 7 }, await token());
    expect(res.status).toBe(200);
    const q = lastSql();
    expect(q).toContain("handled_at = now()");
    expect(q).toContain("handled_by =");
  });

  // 두 운영자가 같은 건을 열었을 때 나중 판단이 앞 판단을 조용히 덮으면 안 된다.
  it("이미 처리된 건이면 409", async () => {
    sqlMock.mockResolvedValueOnce([{ is_active: true }]).mockResolvedValueOnce([]);
    const res = await call("PATCH", { target: "report", decision: "approve", id: 7 }, await token());
    expect(res.status).toBe(409);
  });

  // 줄 단위로 가르면 같은 가게 메뉴가 반은 확정, 반은 미확인인 상태가 남는다.
  it("업주 메뉴는 가게 단위로 한꺼번에 승인한다", async () => {
    sqlMock
      .mockResolvedValueOnce([{ is_active: true }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const res = await call("PATCH", { target: "ownerMenu", decision: "approve", placeId: "9", sourceType: "owner" }, await token());
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(3);
    const q = lastSql();
    expect(q).toContain("place_id =");
    expect(q).toContain("status = 'pending'");
    // 개별 행 id 로 좁히지 않는다는 것이 요점이다. "place_id =" 가 "id =" 를 품고
    // 있어서 단순 부분문자열 검사로는 이걸 확인할 수 없다.
    expect(q).not.toMatch(/WHERE\s+id\s*=/);
  });

  it("반려하면 확인 시각을 남기지 않는다", async () => {
    sqlMock.mockResolvedValueOnce([{ is_active: true }]).mockResolvedValueOnce([{ id: 1 }]);
    await call("PATCH", { target: "ownerMenu", decision: "reject", placeId: "9", sourceType: "owner" }, await token());
    const values = sqlMock.mock.calls.at(-1)!.slice(1);
    expect(values).toContain("rejected");
    expect(values).toContain(null);
  });
});
