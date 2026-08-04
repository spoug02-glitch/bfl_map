import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validateReviewInput } from "@/lib/reviews";

const valid = { placeId: "1080924210", taste: 4, waiting: 2, body: "국물 진함. 12시 전엔 안 기다림" };

describe("validateReviewInput", () => {
  it("accepts a valid input", () => {
    const r = validateReviewInput(valid);
    expect(r).toEqual({ ok: true, value: valid });
  });

  it("rejects body over 100 chars", () => {
    const r = validateReviewInput({ ...valid, body: "가".repeat(101) });
    expect(r.ok).toBe(false);
  });

  it("accepts body of exactly 100 chars", () => {
    const r = validateReviewInput({ ...valid, body: "가".repeat(100) });
    expect(r.ok).toBe(true);
  });

  it("rejects out-of-range ratings", () => {
    expect(validateReviewInput({ ...valid, taste: 0 }).ok).toBe(false);
    expect(validateReviewInput({ ...valid, taste: 6 }).ok).toBe(false);
    expect(validateReviewInput({ ...valid, waiting: 3.5 }).ok).toBe(false);
  });

  it("rejects bad placeId", () => {
    expect(validateReviewInput({ ...valid, placeId: "abc" }).ok).toBe(false);
    expect(validateReviewInput({ ...valid, placeId: "" }).ok).toBe(false);
  });

  it("allows empty body (ratings only)", () => {
    expect(validateReviewInput({ ...valid, body: "" }).ok).toBe(true);
  });

  it("rejects a body containing profanity", () => {
    const r = validateReviewInput({ ...valid, body: "씨발 맛없어" });
    expect(r.ok).toBe(false);
  });

  it("does not mask or alter the body on other validation errors", () => {
    // the rejected profane text must never come back out altered/masked
    const r = validateReviewInput({ ...valid, body: "존나 맛없다" });
    expect(r).toEqual({ ok: false, error: "부적절한 표현이 포함되어 있습니다." });
  });
});

// --- POST /api/reviews rate limit ---
// The rate limiter combines two rules in a single query: a cross-place limit
// (>=5 distinct places written to in the last minute) and a per-place cooldown
// (this place's row was updated within the last 10 seconds). Since the POST
// upserts on UNIQUE(place_id, user_id), repeatedly reviewing the SAME place only
// ever touches one row, so the cooldown is what actually stops same-place abuse.
const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

beforeEach(() => {
  sqlMock.mockReset();
});

async function postReview(userId: string) {
  const { POST } = await import("@/app/api/reviews/route");
  const { createSessionToken, SESSION_COOKIE } = await import("@/lib/session");
  const { NextRequest } = await import("next/server");
  const token = await createSessionToken(userId);
  const req = new NextRequest("http://localhost/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: JSON.stringify(valid),
  });
  return POST(req);
}

describe("POST /api/reviews rate limit", () => {
  it("rejects a repeat write to the same place inside the 10s cooldown", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 1, tooSoon: true, hasNickname: true }]);
    const res = await postReview("user-cooldown-blocked");
    expect(res.status).toBe(429);
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the insert round trip
  });

  it("allows a repeat write to the same place once the cooldown has passed", async () => {
    sqlMock
      .mockResolvedValueOnce([{ recent: 1, tooSoon: false, hasNickname: true }])
      .mockResolvedValueOnce([]);
    const res = await postReview("user-cooldown-passed");
    expect(res.status).toBe(201);
  });

  it("still rejects once a user has written to 5 distinct places in the last minute", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 5, tooSoon: null, hasNickname: true }]);
    const res = await postReview("user-crossplace-limit");
    expect(res.status).toBe(429);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("never blocks a first-ever review for a place (tooSoon is null)", async () => {
    sqlMock
      .mockResolvedValueOnce([{ recent: 0, tooSoon: null, hasNickname: true }])
      .mockResolvedValueOnce([]);
    const res = await postReview("user-first-review");
    expect(res.status).toBe(201);
  });
});

// 모달을 우회해 API를 직접 호출한 경우에 대한 방어
describe("POST /api/reviews nickname guard", () => {
  it("blocks a session that has not set a nickname yet", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0, tooSoon: null, hasNickname: false }]);
    const res = await postReview("user-without-nickname");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "닉네임을 먼저 설정해주세요." });
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the insert round trip
  });
});
