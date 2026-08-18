import { beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeEach(() => {
  sqlMock.mockReset();
});

/** 속도 제한 조회에 답하고, 그 뒤 INSERT 는 빈 결과로 넘긴다. */
function allowRate(recent = 0) {
  sqlMock.mockResolvedValueOnce([{ recent }]).mockResolvedValueOnce([]);
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/reports/route");
  const { NextRequest } = await import("next/server");
  return POST(
    new NextRequest("http://localhost/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const valid = { kind: "place_fix", body: "여기 폐업했어요." };

describe("POST /api/reports", () => {
  it("정상 제보를 저장한다", async () => {
    allowRate();
    const res = await post({ ...valid, placeId: "12345", contact: "a@b.com" });
    expect(res.status).toBe(201);
    const inserted = (sqlMock.mock.calls.at(-1)?.[0] as TemplateStringsArray)
      .join("?")
      .replace(/\s+/g, " ");
    expect(inserted).toContain("INSERT INTO reports");
    // status 를 넣지 않아야 기본값 'open' 이 남는다.
    expect(inserted).not.toContain("status");
  });

  // 400 을 주면 어느 칸이 덫인지 알려주는 꼴이라, 봇에게는 성공처럼 보여야 한다.
  it("허니팟이 차 있으면 201 이지만 DB 를 건드리지 않는다", async () => {
    const res = await post({ ...valid, website: "http://spam.example" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("허니팟이 공백뿐이면 사람으로 본다", async () => {
    allowRate();
    const res = await post({ ...valid, website: "   " });
    expect(res.status).toBe(201);
    expect(sqlMock).toHaveBeenCalled();
  });

  it("종류가 빠지면 400 이고 DB 를 건드리지 않는다", async () => {
    const res = await post({ body: "내용" });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("내용이 비면 400", async () => {
    const res = await post({ kind: "place_fix", body: "   " });
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("JSON 이 아니면 400", async () => {
    const { POST } = await import("@/app/api/reports/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(
      new NextRequest("http://localhost/api/reports", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("분당 제출이 차면 429 이고 저장하지 않는다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 5 }]);
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  // 세션이 없어 사람별로 셀 수 없다. created_at 만 보고 전역으로 센다.
  it("속도 제한은 created_at 만 보고 전역으로 센다", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 5 }]);
    await post(valid);
    const q = (sqlMock.mock.calls[0][0] as TemplateStringsArray).join("?").replace(/\s+/g, " ");
    expect(q).toContain("FROM reports");
    expect(q).toContain("created_at > now() - interval '1 minute'");
    expect(q).not.toContain("user_id");
  });
});
