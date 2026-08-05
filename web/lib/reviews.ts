import { PLACE_ID_RE } from "@/lib/constants";
import { containsProfanity } from "@/lib/profanity";

/** 별점과 본문 — 새로 쓸 때와 고칠 때가 공유하는 부분. */
export type ReviewBody = { taste: number; waiting: number; body: string };
export type ReviewInput = ReviewBody & { placeId: string };

const MAX_BODY_LEN = 100;

function isRating(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** 수정은 어느 가게인지 다시 받지 않는다 — 리뷰 id가 이미 그걸 가리킨다. */
export function validateReviewBody(input: unknown): Result<ReviewBody> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "잘못된 요청입니다." };
  const o = input as Record<string, unknown>;
  if (!isRating(o.taste)) return { ok: false, error: "맛 별점은 1~5 정수여야 합니다." };
  if (!isRating(o.waiting)) return { ok: false, error: "점심 웨이팅 별점은 1~5 정수여야 합니다." };
  if (typeof o.body !== "string" || [...o.body].length > MAX_BODY_LEN) {
    return { ok: false, error: `리뷰는 ${MAX_BODY_LEN}자 이하여야 합니다.` };
  }
  if (containsProfanity(o.body)) {
    return { ok: false, error: "부적절한 표현이 포함되어 있습니다." };
  }
  return { ok: true, value: { taste: o.taste, waiting: o.waiting, body: o.body } };
}

export function validateReviewInput(input: unknown): Result<ReviewInput> {
  const inner = validateReviewBody(input);
  if (!inner.ok) return inner;
  const o = input as Record<string, unknown>;
  if (typeof o.placeId !== "string" || !PLACE_ID_RE.test(o.placeId)) {
    return { ok: false, error: "잘못된 가게 ID입니다." };
  }
  return { ok: true, value: { ...inner.value, placeId: o.placeId } };
}
