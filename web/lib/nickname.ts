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

/** 첫 로그인 모달의 입력칸에 미리 채워 넣을 값. 중복을 허용하므로 충돌은 검사하지 않는다. */
export function suggestNickname(): string {
  return `${SUGGEST_PREFIX}${1000 + Math.floor(Math.random() * 9000)}`;
}
