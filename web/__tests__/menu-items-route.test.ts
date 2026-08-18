import { beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeEach(() => {
  sqlMock.mockReset();
});

async function call(query = "") {
  const { GET } = await import("@/app/api/menu-items/route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest(`http://localhost/api/menu-items${query}`));
}

/** 태그드 템플릿으로 넘어온 SQL 을 하나의 문자열로 되돌린다. */
function lastSql(): string {
  const strings = sqlMock.mock.calls.at(-1)?.[0] as TemplateStringsArray;
  return strings.join("?").replace(/\s+/g, " ");
}

describe("GET /api/menu-items — 요약(placeId 없음)", () => {
  it("가게별 확정 최저가 하나씩 돌려준다", async () => {
    sqlMock.mockResolvedValueOnce([
      { place_id: "1", price: 8000 },
      { place_id: "2", price: 9500 },
    ]);
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toEqual({ place_id: "1", price: 8000 });
  });

  // 확정되지 않은 제보가 가격 필터를 통과시키면 status 컬럼을 만든 이유가 없어진다.
  it("published 만, 가격 있는 것만 고른다", async () => {
    sqlMock.mockResolvedValueOnce([]);
    await call();
    const q = lastSql();
    expect(q).toContain("status = 'published'");
    expect(q).toContain("price IS NOT NULL");
  });

  it("가게마다 한 행이 되도록 좁힌다", async () => {
    sqlMock.mockResolvedValueOnce([]);
    await call();
    expect(lastSql()).toContain("DISTINCT ON (place_id)");
  });
});

describe("GET /api/menu-items?placeId= — 가게별", () => {
  it("숫자가 아니면 400 이고 DB 를 건드리지 않는다", async () => {
    const res = await call("?placeId=abc");
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("빈 문자열도 400", async () => {
    const res = await call("?placeId=");
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("유효하면 그 가게 항목을 출처와 함께 돌려준다", async () => {
    sqlMock.mockResolvedValueOnce([
      {
        menu_name: "김치찌개",
        price: 9000,
        source_type: "user_report",
        status: "published",
        verified_at: null,
        collected_at: "2026-08-17T00:00:00.000Z",
      },
    ]);
    const res = await call("?placeId=12345");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].source_type).toBe("user_report");
    expect(body.items[0].menu_name).toBe("김치찌개");
  });

  // pending 은 내보낸다 — 화면이 "미확인"으로 구분해 보여준다. rejected 는 아니다.
  it("rejected 는 내보내지 않는다", async () => {
    sqlMock.mockResolvedValueOnce([]);
    await call("?placeId=12345");
    expect(lastSql()).toContain("status <> 'rejected'");
  });
});
