import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ user: null });

  // 표시 이름의 출처는 여기 하나뿐이다. nickname이 null이면 프론트가 설정 모달을 띄운다.
  const [row] = await sql`SELECT nickname FROM users WHERE user_id = ${session.userId}`;
  return NextResponse.json({
    user: { userId: session.userId, nickname: row?.nickname ?? null },
  });
}
