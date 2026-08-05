import { NextRequest, NextResponse } from "next/server";
import { PLACE_ID_RE } from "@/lib/constants";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

async function currentUserId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  return session?.userId ?? null;
}

const unauthorized = () =>
  NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

const badPlaceId = () =>
  NextResponse.json({ error: "잘못된 가게 ID입니다." }, { status: 400 });

export async function GET(req: NextRequest) {
  const userId = await currentUserId(req);
  if (!userId) return unauthorized();
  const rows = await sql`
    SELECT place_id FROM saved_places WHERE user_id = ${userId} ORDER BY saved_at DESC`;
  return NextResponse.json({ placeIds: rows.map(r => r.place_id) });
}

export async function PUT(req: NextRequest) {
  const userId = await currentUserId(req);
  if (!userId) return unauthorized();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const placeId =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>).placeId
      : undefined;
  if (typeof placeId !== "string" || !PLACE_ID_RE.test(placeId)) return badPlaceId();

  // 같은 가게를 두 번 저장해도 그냥 저장된 상태다 — 눌린 횟수를 셀 이유가 없다.
  await sql`
    INSERT INTO saved_places (user_id, place_id) VALUES (${userId}, ${placeId})
    ON CONFLICT (user_id, place_id) DO NOTHING`;
  return NextResponse.json({ saved: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await currentUserId(req);
  if (!userId) return unauthorized();
  const placeId = req.nextUrl.searchParams.get("placeId") ?? "";
  if (!PLACE_ID_RE.test(placeId)) return badPlaceId();
  await sql`DELETE FROM saved_places WHERE user_id = ${userId} AND place_id = ${placeId}`;
  return NextResponse.json({ saved: false });
}
