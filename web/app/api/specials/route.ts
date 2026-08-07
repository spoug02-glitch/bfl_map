import { NextRequest, NextResponse } from "next/server";
import { PLACE_ID_RE } from "@/lib/constants";
import { sql } from "@/lib/db";
import { validateSpecialInput } from "@/lib/specials";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId") ?? "";
  if (!PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ error: "placeId가 필요합니다." }, { status: 400 });
  }
  // 닉네임은 안 내보낸다 — 제보는 게시물이 아니라 정보라, 누가 남겼는지가
  // 내용에 보태는 게 없다. user_id는 덮어쓰기와 탈퇴 삭제를 위해서만 존재한다.
  const specials = await sql`
    SELECT menu_name, price, taste, note, created_at
    FROM lunch_specials WHERE place_id = ${placeId}
    ORDER BY created_at DESC LIMIT 20`;
  return NextResponse.json({ specials });
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
  const v = validateSpecialInput(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { placeId, menuName, price, taste, note } = v.value;

  // 리뷰와 같은 이유의 속도 제한 — 서버리스 인스턴스는 메모리를 공유하지 않는다.
  const [{ recent, hasUser }] = await sql`
    SELECT
      (SELECT count(*)::int FROM lunch_specials
        WHERE user_id = ${session.userId} AND created_at > now() - interval '1 minute') AS recent,
      EXISTS (SELECT 1 FROM users WHERE user_id = ${session.userId}) AS "hasUser"`;
  if (!hasUser) {
    return NextResponse.json({ error: "닉네임을 먼저 설정해주세요." }, { status: 409 });
  }
  if (recent >= 5) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  // 리뷰와 달리 upsert다. 특선은 방문 기록이 아니라 현재 상태라, 같은 사람의
  // 새 제보가 옛 제보를 대신한다. 도배도 원천적으로 안 된다 — 자리가 하나뿐이다.
  await sql`
    INSERT INTO lunch_specials (place_id, user_id, menu_name, price, taste, note)
    VALUES (${placeId}, ${session.userId}, ${menuName}, ${price}, ${taste}, ${note})
    ON CONFLICT (place_id, user_id) DO UPDATE
    SET menu_name = EXCLUDED.menu_name, price = EXCLUDED.price,
        taste = EXCLUDED.taste, note = EXCLUDED.note, created_at = now()`;
  return NextResponse.json({ ok: true }, { status: 201 });
}
