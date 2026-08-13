import { containsProfanity } from "@/lib/profanity";

export const NICKNAME_MIN_LEN = 2;
export const NICKNAME_MAX_LEN = 12;

/**
 * 탈퇴한 사람의 글에 남는 이름과 그 글들을 물려받는 계정.
 *
 * 탈퇴하면 계정 행은 지워지지만(카카오 회원번호가 거기 있다) 글은 이 계정으로
 * 옮겨져 남는다. user_id에 콜론이 없어 실제 계정('kakao:123')과 겹치지 않는다.
 */
export const WITHDRAWN_USER_ID = "withdrawn";
export const WITHDRAWN_NICKNAME = "익명의 저녁러";

// 한글 완성형·영문·숫자·밑줄만. 자모 단독(ㄱ, ㅏ)은 가-힣 범위 밖이라 자연히 걸러진다.
const CHARSET_RE = /^[가-힣a-zA-Z0-9_]+$/;

/** 공백과 대소문자를 지운 비교용 형태. 사칭은 그 둘로 눈을 속인다. */
function foldForCompare(value: string): string {
  return value.replace(/\s/g, "").toLowerCase();
}

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
  // 탈퇴자 이름은 예약어다. 문자셋이 공백을 막으니 '익명의 저녁러' 자체는 만들 수
  // 없지만, 공백을 뺀 '익명의저녁러'는 만들 수 있어 그대로 사칭이 된다.
  if (foldForCompare(value) === foldForCompare(WITHDRAWN_NICKNAME)) {
    return { ok: false, error: "쓸 수 없는 닉네임이에요." };
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
