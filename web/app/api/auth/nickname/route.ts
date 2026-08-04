import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validateNickname } from "@/lib/nickname";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function PUT(req: NextRequest) {
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
  const raw =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>).nickname
      : undefined;
  const v = validateNickname(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await sql`
    INSERT INTO users (user_id, nickname) VALUES (${session.userId}, ${v.value})
    ON CONFLICT (user_id)
    DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = now()`;
  return NextResponse.json({ nickname: v.value });
}
