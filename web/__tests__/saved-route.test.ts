import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function headers(authed: boolean) {
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const h: Record<string, string> = { "content-type": "application/json" };
  if (authed) h.cookie = `${SESSION_COOKIE}=${await createSessionToken("kakao:saver")}`;
  return h;
}

async function get(authed = true) {
  const { GET } = await import("@/app/api/saved/route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest("http://localhost/api/saved", { headers: await headers(authed) }));
}

async function put(placeId: unknown, authed = true) {
  const { PUT } = await import("@/app/api/saved/route");
  const { NextRequest } = await import("next/server");
  return PUT(
    new NextRequest("http://localhost/api/saved", {
      method: "PUT",
      headers: await headers(authed),
      body: JSON.stringify({ placeId }),
    }),
  );
}

async function del(placeId: string, authed = true) {
  const { DELETE } = await import("@/app/api/saved/route");
  const { NextRequest } = await import("next/server");
  return DELETE(
    new NextRequest(`http://localhost/api/saved?placeId=${encodeURIComponent(placeId)}`, {
      method: "DELETE",
      headers: await headers(authed),
    }),
  );
}

describe("GET /api/saved", () => {
  it("rejects an anonymous caller", async () => {
    const res = await get(false);
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns the caller's saved place ids", async () => {
    sqlMock.mockResolvedValueOnce([{ place_id: "1" }, { place_id: "2" }]);
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ placeIds: ["1", "2"] });
  });
});

describe("PUT /api/saved", () => {
  it("rejects an anonymous caller", async () => {
    const res = await put("1080924210", false);
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it.each([undefined, 42, "abc", "", "1;DROP"])(
    "rejects the bad placeId %j without touching the database",
    async (bad) => {
      const res = await put(bad);
      expect(res.status).toBe(400);
      expect(sqlMock).not.toHaveBeenCalled();
    },
  );

  it("saves a valid place", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await put("1080924210");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: true });
  });
});

describe("DELETE /api/saved", () => {
  it("rejects an anonymous caller", async () => {
    const res = await del("1080924210", false);
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects a bad placeId", async () => {
    const res = await del("abc");
    expect(res.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("unsaves a place", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const res = await del("1080924210");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ saved: false });
  });
});
