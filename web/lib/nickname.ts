import { containsProfanity } from "@/lib/profanity";

export const NICKNAME_MIN_LEN = 2;
export const NICKNAME_MAX_LEN = 12;

// 한글 완성형·영문·숫자·밑줄만. 자모 단독(ㄱ, ㅏ)은 가-힣 범위 밖이라 자연히 걸러진다.
const CHARSET_RE = /^[가-힣a-zA-Z0-9_]+$/;

export function validateNickname(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "닉네임을 입력해주세요." };
  const value = input.normalize("NFC");
  const len = [...value].length;
  if (len < NICKNAME_MIN_LEN || len > NICKNAME_MAX_LEN) {
    return { ok: false, error: `닉네임은 ${NICKNAME_MIN_LEN}~${NICKNAME_MAX_LEN}자여야 해요.` };
  }
  if (!CHARSET_RE.test(value)) {
    return { ok: false, error: "한글, 영문, 숫자, 밑줄만 쓸 수 있어요." };
  }
  if (containsProfanity(value)) {
    return { ok: false, error: "부적절한 표현이 포함되어 있습니다." };
  }
  return { ok: true, value };
}

const SUGGEST_PREFIX = "점심러";
const SUGGEST_MIN = 100000;
const SUGGEST_RANGE = 900000;

/**
 * 첫 로그인 모달의 입력칸에 미리 채워 넣을 값.
 *
 * 닉네임은 유니크하므로 이 값도 충돌할 수 있다. 서버가 409로 걸러주지만 그건
 * 사용자에게 마찰이므로, 자리수를 6자리로 잡아 충돌 확률을 실질적으로 없앤다.
 */
export function suggestNickname(): string {
  return `${SUGGEST_PREFIX}${SUGGEST_MIN + Math.floor(Math.random() * SUGGEST_RANGE)}`;
}
