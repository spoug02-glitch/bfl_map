import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validateReviewInput } from "@/lib/reviews";

const valid = { placeId: "1080924210", taste: 4, convenience: 2, body: "국물 진함. 12시 전엔 안 기다림" };

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
    expect(validateReviewInput({ ...valid, convenience: 3.5 }).ok).toBe(false);
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

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

describe("POST /api/reviews weekly cooldown", () => {
  it("accepts the first review a user writes for a place", async () => {
    sqlMock
      .mockResolvedValueOnce([{ recent: 0, lastHere: null, hasNickname: true }])
      .mockResolvedValueOnce([]);
    const res = await postReview("user-first-review");
    expect(res.status).toBe(201);
  });

  it("blocks a second review for the same place inside 7 days and names the date", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 1, lastHere: daysAgo(2), hasNickname: true }]);
    const res = await postReview("user-too-soon");
    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toContain("7일에 한 번");
    const expected = new Date(Date.now() + 5 * DAY_MS + 9 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    expect(error).toContain(expected);
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the insert round trip
  });

  it("lets the same person review the same place again after 7 days", async () => {
    // 같은 집을 또 가는 건 흔한 일이다 — 예전 리뷰를 덮지 않고 새로 쌓인다.
    sqlMock
      .mockResolvedValueOnce([{ recent: 0, lastHere: daysAgo(8), hasNickname: true }])
      .mockResolvedValueOnce([]);
    const res = await postReview("user-revisit");
    expect(res.status).toBe(201);
  });

  it("still rejects once a user has written to 5 places in the last minute", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 5, lastHere: null, hasNickname: true }]);
    const res = await postReview("user-crossplace-limit");
    expect(res.status).toBe(429);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });
});

// 모달을 우회해 API를 직접 호출한 경우에 대한 방어
describe("POST /api/reviews nickname guard", () => {
  it("blocks a session that has not set a nickname yet", async () => {
    sqlMock.mockResolvedValueOnce([{ recent: 0, lastHere: null, hasNickname: false }]);
    const res = await postReview("user-without-nickname");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "닉네임을 먼저 설정해주세요." });
    expect(sqlMock).toHaveBeenCalledTimes(1); // rejected before the insert round trip
  });
});
