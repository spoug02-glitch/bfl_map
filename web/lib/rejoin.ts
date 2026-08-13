import { createHmac } from "node:crypto";

/**
 * 탈퇴 후 다시 가입할 수 있을 때까지의 기간(일).
 *
 * 리뷰 쿨다운과 같은 7일이다. 익명화 탈퇴에는 구멍이 하나 있다 — 글이 지워지지
 * 않고 남으므로, 탈퇴했다 돌아오면 같은 가게에 리뷰를 하나 더 쓸 수 있다.
 * 재가입을 쿨다운과 같은 기간만큼 막으면 돌아왔을 땐 어차피 다시 쓸 수 있는
 * 시점이라, 왕복해서 얻는 것이 없어진다.
 */
export const REJOIN_BLOCK_DAYS = 7;

/**
 * 탈퇴한 계정을 알아보기 위한 지문.
 *
 * 카카오 회원번호를 그대로 보관하지 않는다. 탈퇴하면 그 번호를 지운다고 공지했고,
 * 재가입을 막자고 그 약속을 무를 수는 없다. HMAC은 되돌릴 수 없으므로, 이 표에
 * 남는 건 "어떤 계정이 탈퇴했다"는 사실뿐이고 그게 누구인지는 알 수 없다.
 * 서버가 특정 번호를 가져와 대조할 때만 일치 여부가 나온다 — 로그인 순간이 정확히
 * 그 상황이다.
 *
 * 용도 문자열을 앞에 붙여 세션 서명과 같은 비밀에서 나온 값이라도 서로 섞이지
 * 않게 한다.
 */
export function withdrawalFingerprint(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`withdrawal:${userId}`).digest("hex");
}
