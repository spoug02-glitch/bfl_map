import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// 정적 세그먼트라 /api/reviews/[id]보다 먼저 잡힌다 — "mine"은 리뷰 id로 해석되지 않는다.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  // 가게 이름은 붙이지 않는다 — 그건 restaurants.json에 있고 클라이언트가 이미 들고 있다.
  const reviews = await sql`
    SELECT id, place_id, taste, convenience, body, created_at
    FROM reviews WHERE user_id = ${session.userId}
    ORDER BY created_at DESC LIMIT 100`;
  return NextResponse.json({ reviews });
}
