import { NextRequest, NextResponse } from "next/server";
import { PLACE_ID_RE } from "@/lib/constants";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");

  // placeId 없이 부르면 가격 필터용 요약이다: 가게마다 확정된 최저가 하나.
  // 필터는 지도의 모든 가게를 한 번에 봐야 해서 가게별 왕복으로는 못 만든다
  // (/api/specials 가 같은 이유로 같은 모양을 쓴다).
  //
  // published 만 세는 게 핵심이다. pending 을 세면 확정되지 않은 한 사람의 제보가
  // 가격 필터를 통과시키게 되고, 그건 status 컬럼을 만든 이유를 무효로 만든다.
  if (placeId === null) {
    const items = await sql`
      SELECT DISTINCT ON (place_id) place_id, price
      FROM menu_items
      WHERE status = 'published' AND price IS NOT NULL
      ORDER BY place_id, price ASC`;
    return NextResponse.json({ items });
  }

  if (!PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ error: "placeId가 필요합니다." }, { status: 400 });
  }

  // rejected 는 내보내지 않는다. pending 은 내보낸다 — 화면이 "미확인"으로 구분해
  // 보여주고, 감춰버리면 제보한 사람이 자기 제보가 사라진 줄 안다.
  const items = await sql`
    SELECT menu_name, price, source_type, status, verified_at, collected_at
    FROM menu_items
    WHERE place_id = ${placeId} AND status <> 'rejected'
    ORDER BY status DESC, price ASC NULLS LAST
    LIMIT 50`;
  return NextResponse.json({ items });
}
