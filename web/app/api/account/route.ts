import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * 회원 탈퇴. 이 계정이 남긴 것을 전부 지운다.
 *
 * 리뷰도 같이 지운다. 닉네임이 붙어 공개되는 글이라 계정만 지우고 남겨둘 수가
 * 없고, 남겨두면 users를 참조하는 외래 키도 끊긴다. 가게 평점이 그만큼 바뀌는
 * 것은 지우는 쪽이 맞다고 보고 감수한다.
 *
 * 카카오 계정과의 연결까지 끊으려면 어드민 키를 서버에 둬야 한다. 그건 진짜
 * 비밀키라 보관 자체가 위험 부담이므로, 우리 데이터만 지우고 카카오 쪽 해제는
 * 처리방침에서 안내한다.
 */
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 한 트랜잭션으로 묶는다. 따로 보내면 중간에 끊겼을 때 리뷰만 사라지고 계정은
  // 남는 상태가 만들어진다 — "지웠다"고 답해놓고 식별자를 들고 있는 셈이라
  // 탈퇴에서는 그 중간 상태가 존재하면 안 된다.
  // 외래 키 때문에 순서도 정해져 있다: users를 참조하는 것들이 먼저다.
  await sql.transaction([
    sql`DELETE FROM saved_places WHERE user_id = ${session.userId}`,
    sql`DELETE FROM reviews WHERE user_id = ${session.userId}`,
    sql`DELETE FROM lunch_specials WHERE user_id = ${session.userId}`,
    sql`DELETE FROM users WHERE user_id = ${session.userId}`,
  ]);

  // 세션도 함께 끝낸다 — 지워진 계정의 쿠키를 들고 다니게 두면 안 된다.
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
