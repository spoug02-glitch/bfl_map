import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateReviewInput } from "@/lib/reviews";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId") ?? "";
  if (!/^\d{1,20}$/.test(placeId)) {
    return NextResponse.json({ error: "placeId가 필요합니다." }, { status: 400 });
  }
  const reviews = await sql`
    SELECT nickname, taste, waiting, body, updated_at
    FROM reviews WHERE place_id = ${placeId}
    ORDER BY updated_at DESC LIMIT 50`;
  const [summary] = await sql`
    SELECT count(*)::int AS count,
           round(avg(taste), 1)::float AS "avgTaste",
           round(avg(waiting), 1)::float AS "avgWaiting"
    FROM reviews WHERE place_id = ${placeId}`;
  return NextResponse.json({ reviews, summary });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "구글 로그인이 필요합니다." }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const v = validateReviewInput(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { placeId, taste, waiting, body } = v.value;
  // rate limit: max 5 writes to distinct places per user per minute, counted from the DB
  // (serverless instances don't share memory, so an in-memory counter is useless)
  // plus a per-place cooldown, since the POST upserts and repeatedly reviewing the
  // SAME place would otherwise never move the distinct-place count
  const [{ recent, tooSoon }] = await sql`
    SELECT
      (SELECT count(*)::int FROM reviews
        WHERE user_id = ${user.userId} AND updated_at > now() - interval '1 minute') AS recent,
      (SELECT updated_at > now() - interval '10 seconds' FROM reviews
        WHERE user_id = ${user.userId} AND place_id = ${placeId}) AS "tooSoon"`;
  if (recent >= 5 || tooSoon === true) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }
  await sql`
    INSERT INTO reviews (place_id, user_id, nickname, taste, waiting, body)
    VALUES (${placeId}, ${user.userId}, ${user.nickname}, ${taste}, ${waiting}, ${body})
    ON CONFLICT (place_id, user_id)
    DO UPDATE SET taste = EXCLUDED.taste, waiting = EXCLUDED.waiting,
                  body = EXCLUDED.body, nickname = EXCLUDED.nickname, updated_at = now()`;
  return NextResponse.json({ ok: true }, { status: 201 });
}
