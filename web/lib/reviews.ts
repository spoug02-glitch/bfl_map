import { containsProfanity } from "@/lib/profanity";

export type ReviewInput = { placeId: string; taste: number; waiting: number; body: string };

const MAX_BODY_LEN = 100;
const PLACE_ID_RE = /^\d{1,20}$/;

function isRating(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

export function validateReviewInput(
  input: unknown,
): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "잘못된 요청입니다." };
  const o = input as Record<string, unknown>;
  if (typeof o.placeId !== "string" || !PLACE_ID_RE.test(o.placeId)) {
    return { ok: false, error: "잘못된 가게 ID입니다." };
  }
  if (!isRating(o.taste)) return { ok: false, error: "맛 별점은 1~5 정수여야 합니다." };
  if (!isRating(o.waiting)) return { ok: false, error: "점심 웨이팅 별점은 1~5 정수여야 합니다." };
  if (typeof o.body !== "string" || [...o.body].length > MAX_BODY_LEN) {
    return { ok: false, error: `리뷰는 ${MAX_BODY_LEN}자 이하여야 합니다.` };
  }
  if (containsProfanity(o.body)) {
    return { ok: false, error: "부적절한 표현이 포함되어 있습니다." };
  }
  return { ok: true, value: { placeId: o.placeId, taste: o.taste, waiting: o.waiting, body: o.body } };
}
