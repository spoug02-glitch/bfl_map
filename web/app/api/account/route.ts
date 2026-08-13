import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { WITHDRAWN_USER_ID } from "@/lib/nickname";
import { withdrawalFingerprint } from "@/lib/rejoin";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * 회원 탈퇴. 계정은 지우고, 남긴 글은 익명으로 남긴다.
 *
 * 지워야 하는 건 "누가 썼는지"이지 글 자체가 아니다. 개인을 가리키는 값은
 * users 행에 있는 카카오 회원번호 하나뿐이므로, 글을 탈퇴자 대표 계정으로
 * 옮긴 뒤 그 행을 지우면 연결이 끊긴다. 리뷰가 통째로 사라져 가게 평점이
 * 흔들리는 일도 없어진다.
 *
 * 대신 되돌릴 수 없다 — 옮기고 나면 그 글이 누구 것이었는지 아무도 모르므로
 * 본인도 수정·삭제할 수 없다. 탈퇴 화면이 그 사실을 먼저 말한다.
 *
 * 카카오 계정과의 연결까지 끊으려면 어드민 키를 서버에 둬야 한다. 그건 진짜
 * 비밀키라 보관 자체가 위험 부담이므로, 우리 데이터만 정리하고 카카오 쪽 해제는
 * 처리방침에서 안내한다.
 */
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const me = session.userId;

  // 한 트랜잭션으로 묶는다. 따로 보내면 중간에 끊겼을 때 글은 옮겨졌는데 계정은
  // 남는 상태가 만들어진다 — "지웠다"고 답해놓고 식별자를 들고 있는 셈이라
  // 탈퇴에서는 그 중간 상태가 존재하면 안 된다.
  await sql.transaction([
    // 저장한 가게는 남에게 보이지 않는 개인 목록이라 익명으로 남길 값이 없다.
    sql`DELETE FROM saved_places WHERE user_id = ${me}`,

    // 리뷰는 그대로 옮긴다. users 외래 키 때문에 계정 삭제보다 반드시 먼저다.
    sql`UPDATE reviews SET user_id = ${WITHDRAWN_USER_ID} WHERE user_id = ${me}`,

    // 점심특선은 (place_id, user_id)가 기본키라 그냥 옮기면 같은 가게에 두 행이
    // 생겨 터진다. 한 가게에 하나만 남기되 최신 제보를 살린다 —
    // 특선은 바뀌는 정보라 오래된 쪽을 남길 이유가 없다.
    sql`DELETE FROM lunch_specials w
        USING lunch_specials m
        WHERE w.user_id = ${WITHDRAWN_USER_ID} AND m.user_id = ${me}
          AND w.place_id = m.place_id
          AND w.created_at <= m.created_at`,
    sql`DELETE FROM lunch_specials m
        USING lunch_specials w
        WHERE m.user_id = ${me} AND w.user_id = ${WITHDRAWN_USER_ID}
          AND m.place_id = w.place_id`,
    sql`UPDATE lunch_specials SET user_id = ${WITHDRAWN_USER_ID} WHERE user_id = ${me}`,

    // 카카오 회원번호가 담긴 행. 이걸 지우는 순간 연결이 끊긴다.
    sql`DELETE FROM users WHERE user_id = ${me}`,

    // 되돌릴 수 없는 지문만 남긴다. 익명화 탈퇴는 글을 남기므로, 곧바로 돌아오면
    // 같은 가게에 리뷰를 하나 더 쓸 수 있다 — 재가입을 리뷰 쿨다운과 같은 기간만큼
    // 미루면 그 왕복으로 얻는 것이 없어진다. 같은 트랜잭션 안에 둬야 계정만
    // 지워지고 지문은 안 남는 상태가 생기지 않는다.
    sql`INSERT INTO withdrawals (fingerprint) VALUES (${withdrawalFingerprint(me)})
        ON CONFLICT (fingerprint) DO UPDATE SET withdrawn_at = now()`,
  ]);

  // 세션도 함께 끝낸다 — 지워진 계정의 쿠키를 들고 다니게 두면 안 된다.
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
