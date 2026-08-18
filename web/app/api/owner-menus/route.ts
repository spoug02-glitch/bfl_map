import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { looksLikeBot, validateOwnerMenuInput } from "@/lib/reports";

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 봇에게는 성공한 것처럼 답한다 — /api/reports 와 같은 이유다.
  if (looksLikeBot(json)) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const v = validateOwnerMenuInput(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { placeId, contact, menus } = v.value;

  // 세션이 없어 전역으로 센다. 업주 제출만 세도록 source_type 으로 좁힌다 —
  // 수집기가 넣는 행까지 세면 배치 한 번에 접수구가 통째로 닫힌다.
  const [{ recent }] = await sql`
    SELECT count(*)::int AS recent FROM menu_items
    WHERE source_type = 'owner' AND collected_at > now() - interval '1 minute'`;
  if (recent >= 5) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  // 한 트랜잭션으로 묶는다. 줄마다 따로 보내면 중간에 끊겼을 때 메뉴판의 절반만
  // 들어간 가게가 남는데, 업주는 다 넣었다고 믿고 어드민은 그게 전부인 줄 안다.
  // 아예 안 들어간 것보다 나쁘다.
  //
  // verified_at 은 넣지 않는다 — 승인 시각을 적는 자리라 비어 있는 게 "미확인"이다.
  // source_ref 에는 제출자 연락처를 둔다. 승인 전에 확인할 일이 생기면 어드민이
  // 이 값으로 연락한다.
  await sql.transaction(
    menus.map(
      m => sql`
        INSERT INTO menu_items (place_id, menu_name, price, source_type, source_ref, status)
        VALUES (${placeId}, ${m.menuName}, ${m.price}, 'owner', ${contact}, 'pending')`,
    ),
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
