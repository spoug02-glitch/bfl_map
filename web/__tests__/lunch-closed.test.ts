import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LUNCH_CLOSED_MIN_REPORTS, closedAtLunch, validatePlaceId,
} from "@/lib/lunch-closed";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

describe("closedAtLunch", () => {
  it("제보가 없으면 '모른다'이지 '휴무'가 아니다", () => {
    expect(closedAtLunch(new Map(), "111")).toBe(false);
  });

  it("한 명만으로는 안 빠진다 — 빼는 제보라 한 사람이 지울 수 있으면 안 된다", () => {
    expect(closedAtLunch(new Map([["111", 1]]), "111")).toBe(false);
  });

  it("문턱을 넘으면 빠진다", () => {
    expect(closedAtLunch(new Map([["111", LUNCH_CLOSED_MIN_REPORTS]]), "111")).toBe(true);
    expect(closedAtLunch(new Map([["111", 9]]), "111")).toBe(true);
  });

  it("다른 가게의 제보는 이 가게에 영향이 없다", () => {
    expect(closedAtLunch(new Map([["222", 5]]), "111")).toBe(false);
  });
});

describe("validatePlaceId", () => {
  it("숫자 문자열만 받는다", () => {
    expect(validatePlaceId({ placeId: "1394091751" })).toEqual({ ok: true, placeId: "1394091751" });
  });

  it.each([{}, null, { placeId: "" }, { placeId: "abc" }, { placeId: 123 }, { placeId: "1; DROP" }])(
    "%o 는 거절한다",
    input => {
      expect(validatePlaceId(input).ok).toBe(false);
    },
  );
});

async function headers(authed: boolean) {
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const h: Record<string, string> = { "content-type": "application/json" };
  if (authed) h.cookie = `${SESSION_COOKIE}=${await createSessionToken("kakao:reporter")}`;
  return h;
}

async function get(authed = false) {
  const { GET } = await import("@/app/api/lunch-closed/route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest("http://localhost/api/lunch-closed", { headers: await headers(authed) }));
}

async function post(placeId: unknown, authed = true) {
  const { POST } = await import("@/app/api/lunch-closed/route");
  const { NextRequest } = await import("next/server");
  return POST(
    new NextRequest("http://localhost/api/lunch-closed", {
      method: "POST",
      headers: await headers(authed),
      body: JSON.stringify({ placeId }),
    }),
  );
}

async function del(placeId: string, authed = true) {
  const { DELETE } = await import("@/app/api/lunch-closed/route");
  const { NextRequest } = await import("next/server");
  return DELETE(
    new NextRequest(`http://localhost/api/lunch-closed?placeId=${encodeURIComponent(placeId)}`, {
      method: "DELETE",
      headers: await headers(authed),
    }),
  );
}

describe("GET /api/lunch-closed", () => {
  it("비로그인도 집계를 받는다 — 필터는 로그인과 무관하게 걸린다", async () => {
    sqlMock.mockResolvedValueOnce([{ place_id: "111", reports: 2 }]);
    const res = await get(false);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.counts).toEqual([{ place_id: "111", reports: 2 }]);
    expect(body.mine).toEqual([]);
    // 로그인하지 않았으면 내 제보를 묻는 두 번째 질의는 아예 하지 않는다
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("로그인하면 내가 누른 가게도 함께 받는다", async () => {
    sqlMock
      .mockResolvedValueOnce([{ place_id: "111", reports: 2 }])
      .mockResolvedValueOnce([{ place_id: "111" }]);
    const body = await (await get(true)).json();
    expect(body.mine).toEqual(["111"]);
  });
});

describe("POST /api/lunch-closed", () => {
  it("비로그인은 제보할 수 없다 — 아무 DB 질의도 하지 않는다", async () => {
    const res = await post("111", false);
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("잘못된 placeId는 400이다", async () => {
    const res = await post("nope");
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("닉네임이 없으면 409로 돌려보낸다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0, hasUser: false }]);
    expect((await post("111")).status).toBe(409);
  });

  it("짧은 시간에 몰아치면 429다 — 이건 가게를 빼는 제보라 더 조인다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 3, hasUser: true }]);
    expect((await post("111")).status).toBe(429);
  });

  it("정상 제보는 201이고, 같은 사람이 두 번 눌러도 표가 늘지 않는다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0, hasUser: true }]).mockResolvedValueOnce([]);
    const res = await post("1394091751");
    expect(res.status).toBe(201);
    const insert = sqlMock.mock.calls[1][0].join("?");
    expect(insert).toContain("INSERT INTO lunch_closed_reports");
    expect(insert).toContain("ON CONFLICT (place_id, user_id) DO NOTHING");
  });
});

describe("DELETE /api/lunch-closed", () => {
  it("비로그인은 지울 수 없다", async () => {
    expect((await del("111", false)).status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("내 제보만 지운다 — 남의 표를 건드리면 안 된다", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await del("111");
    expect(res.status).toBe(200);
    const q = sqlMock.mock.calls[0][0].join("?");
    expect(q).toContain("DELETE FROM lunch_closed_reports");
    expect(q).toContain("user_id =");
  });
});
