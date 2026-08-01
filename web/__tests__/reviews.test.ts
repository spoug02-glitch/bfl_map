import { describe, expect, it } from "vitest";
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
