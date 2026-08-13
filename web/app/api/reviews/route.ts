import { NextRequest, NextResponse } from "next/server";
import { PLACE_ID_RE } from "@/lib/constants";
import { sql } from "@/lib/db";
import { kstDate, kstDateTime } from "@/lib/kst";
import { suspensionNotice } from "@/lib/legal";
import { validateReviewInput } from "@/lib/reviews";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isPermanentSuspension } from "@/lib/suspension";
import { isSuspended } from "@/lib/suspension-server";

/** 같은 가게에 다시 쓰기까지 기다려야 하는 기간. */
const REVIEW_COOLDOWN_DAYS = 7;
const REVIEW_COOLDOWN_MS = REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId") ?? "";
  if (!PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ error: "placeId가 필요합니다." }, { status: 400 });
  }
  // 내 리뷰에만 수정·삭제 버튼을 붙이려면 클라이언트가 어느 게 자기 것인지 알아야
  // 한다. user_id를 내려보내면 남의 계정 식별자까지 노출되므로 서버가 판정해 준다.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const me = session?.userId ?? null;
  const reviews = await sql`
    SELECT r.id, u.nickname, r.taste, r.convenience, r.body, r.created_at,
           COALESCE(r.user_id = ${me}, false) AS mine
    FROM reviews r JOIN users u ON u.user_id = r.user_id
    WHERE r.place_id = ${placeId}
    ORDER BY r.created_at DESC LIMIT 50`;
  const [summary] = await sql`
    SELECT count(*)::int AS count,
           round(avg(taste), 1)::float AS "avgTaste",
           round(avg(convenience), 1)::float AS "avgConvenience"
    FROM reviews WHERE place_id = ${placeId}`;
  return NextResponse.json({ reviews, summary });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const v = validateReviewInput(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { placeId, taste, convenience, body } = v.value;
  const suspension = await isSuspended(session.userId);
  if (suspension.suspended) {
    const until = suspension.until!;
    const notice = suspensionNotice(isPermanentSuspension(until) ? null : kstDateTime(until));
    return NextResponse.json({ error: notice }, { status: 403 });
  }
  // 한 왕복으로 세 가지를 묻는다. 서버리스 인스턴스끼리 메모리를 공유하지 않으니
  // 횟수 제한은 DB에서 세야 한다.
  const [{ recent, lastHere, hasNickname }] = await sql`
    SELECT
      (SELECT count(*)::int FROM reviews
        WHERE user_id = ${session.userId} AND created_at > now() - interval '1 minute') AS recent,
      (SELECT max(created_at) FROM reviews
        WHERE user_id = ${session.userId} AND place_id = ${placeId}) AS "lastHere",
      EXISTS (SELECT 1 FROM users WHERE user_id = ${session.userId}) AS "hasNickname"`;
  // 닉네임이 없으면 INSERT가 외래 키에서 터진다. 그 전에 읽을 수 있는 이유로 막는다.
  if (!hasNickname) {
    return NextResponse.json({ error: "닉네임을 먼저 설정해주세요." }, { status: 409 });
  }
  // 같은 가게라도 다시 갔으면 다시 쓸 수 있다. 다만 일주일에 한 번이다 —
  // 그 이상은 방문 기록이 아니라 평점 밀기가 된다.
  if (lastHere) {
    const nextAllowed = new Date(+new Date(lastHere) + REVIEW_COOLDOWN_MS);
    if (Date.now() < nextAllowed.getTime()) {
      return NextResponse.json(
        {
          error: `같은 가게 리뷰는 ${REVIEW_COOLDOWN_DAYS}일에 한 번만 쓸 수 있어요. ${kstDate(nextAllowed)}부터 가능해요.`,
        },
        { status: 429 },
      );
    }
  }
  if (recent >= 5) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }
  // upsert가 아니라 INSERT다. 예전 리뷰를 덮지 않고 방문마다 쌓인다.
  await sql`
    INSERT INTO reviews (place_id, user_id, taste, convenience, body)
    VALUES (${placeId}, ${session.userId}, ${taste}, ${convenience}, ${body})`;
  return NextResponse.json({ ok: true }, { status: 201 });
}
