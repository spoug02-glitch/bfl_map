import { PLACE_ID_RE } from "@/lib/constants";

export const SPECIAL_NAME_MAX = 40;
export const SPECIAL_NOTE_MAX = 100;
/** 점심특선이 이 밖이면 오타다. 백원 미만 특선도, 십만원 넘는 특선도 없다. */
export const SPECIAL_PRICE_MIN = 500;
export const SPECIAL_PRICE_MAX = 100_000;

export type SpecialInput = {
  placeId: string;
  menuName: string;
  price: number;
  /** 안 남겨도 된다. */
  taste: number | null;
  /** 안 남겨도 된다. "평일만", "11:30~13:30 한정" 같은 서술. */
  note: string | null;
};

/**
 * 제보는 누구나 보낼 수 있는 공개 입력이다. 모양이 어긋나면 무엇이 왜 안 되는지
 * 사람이 읽을 문장으로 돌려준다 — 폼이 그대로 에러 줄에 띄운다.
 */
export function validateSpecialInput(
  json: unknown,
): { ok: false; error: string } | { ok: true; value: SpecialInput } {
  if (typeof json !== "object" || json === null) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const { placeId, menuName, price, taste, note } = json as Record<string, unknown>;

  if (typeof placeId !== "string" || !PLACE_ID_RE.test(placeId)) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  if (typeof menuName !== "string" || menuName.trim().length === 0) {
    return { ok: false, error: "메뉴 이름을 적어주세요." };
  }
  const name = menuName.trim();
  if (name.length > SPECIAL_NAME_MAX) {
    return { ok: false, error: `메뉴 이름은 ${SPECIAL_NAME_MAX}자까지예요.` };
  }

  if (typeof price !== "number" || !Number.isInteger(price)) {
    return { ok: false, error: "가격을 숫자로 적어주세요." };
  }
  if (price < SPECIAL_PRICE_MIN || price > SPECIAL_PRICE_MAX) {
    return { ok: false, error: "가격이 점심특선 같지 않아요. 다시 확인해주세요." };
  }

  let tasteValue: number | null = null;
  if (taste !== undefined && taste !== null) {
    if (typeof taste !== "number" || !Number.isInteger(taste) || taste < 1 || taste > 5) {
      return { ok: false, error: "맛 별점은 1~5점이에요." };
    }
    tasteValue = taste;
  }

  let noteValue: string | null = null;
  if (note !== undefined && note !== null) {
    if (typeof note !== "string") return { ok: false, error: "잘못된 요청입니다." };
    const trimmed = note.trim();
    if (trimmed.length > SPECIAL_NOTE_MAX) {
      return { ok: false, error: `비고는 ${SPECIAL_NOTE_MAX}자까지예요.` };
    }
    if (trimmed.length > 0) noteValue = trimmed;
  }

  return { ok: true, value: { placeId, menuName: name, price, taste: tasteValue, note: noteValue } };
}
