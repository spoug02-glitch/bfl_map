import { beforeEach, describe, expect, it, vi } from "vitest";

// 태그드 템플릿 호출은 "어떤 문장인지"만 기록해 두고, 실제 실행은 transaction 이 받는다.
const { sqlMock, transactionMock } = vi.hoisted(() => {
  const transactionMock = vi.fn();
  const fn = vi.fn();
  return { sqlMock: Object.assign(fn, { transaction: transactionMock }), transactionMock };
});
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeEach(() => {
  sqlMock.mockReset();
  transactionMock.mockReset();
  transactionMock.mockResolvedValue([]);
});

async function post(body: unknown) {
  const { POST } = await import("@/app/api/owner-menus/route");
  const { NextRequest } = await import("next/server");
  return POST(
    new NextRequest("http://localhost/api/owner-menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const valid = {
  placeId: "12345",
  contact: "010-0000-0000",
  menus: [{ menuName: "김치찌개", price: 9000 }, { menuName: "된장찌개", price: 8500 }],
};

/** 태그드 템플릿으로 넘어온 SQL 을 하나의 문자열로 되돌린다. */
function sqlAt(i: number): string {
  return (sqlMock.mock.calls[i][0] as TemplateStringsArray).join("?").replace(/\s+/g, " ");
}

describe("POST /api/owner-menus", () => {
  it("메뉴 줄 전부를 한 트랜잭션으로 넣는다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0 }]);
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    // 반쯤 들어간 메뉴판은 아예 없는 것보다 나쁘다 — 줄 수만큼 문장이 한 배열에 담긴다.
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2);
  });

  it("업주 출처로 pending 상태로 넣는다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0 }]);
    await post(valid);
    const insert = sqlAt(1);
    expect(insert).toContain("INSERT INTO menu_items");
    expect(insert).toContain("'owner'");
    expect(insert).toContain("'pending'");
    // verified_at 은 승인 시각 자리다. 비어 있는 게 "미확인"이다.
    expect(insert).not.toContain("verified_at");
  });

  it("연락처를 source_ref 로 남겨 어드민이 연락할 수 있게 한다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0 }]);
    await post(valid);
    expect(sqlAt(1)).toContain("source_ref");
    expect(sqlMock.mock.calls[1].slice(1)).toContain("010-0000-0000");
  });

  it("허니팟이 차 있으면 201 이지만 DB 를 건드리지 않는다", async () => {
    const res = await post({ ...valid, website: "http://spam.example" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(sqlMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("연락처가 없으면 400 이고 DB 를 건드리지 않는다", async () => {
    const res = await post({ ...valid, contact: "" });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("메뉴가 한 줄도 없으면 400", async () => {
    const res = await post({ ...valid, menus: [] });
    expect(res.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("분당 제출이 차면 429 이고 저장하지 않는다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 5 }]);
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // 수집기가 넣는 행까지 세면 배치 한 번에 접수구가 통째로 닫힌다.
  it("속도 제한은 업주 출처 행만 센다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 5 }]);
    await post(valid);
    const q = sqlAt(0);
    expect(q).toContain("source_type = 'owner'");
    expect(q).toContain("interval '1 minute'");
  });
});
