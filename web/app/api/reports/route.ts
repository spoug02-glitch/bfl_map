import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { looksLikeBot, validateReportInput } from "@/lib/reports";

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 봇에게는 성공한 것처럼 답한다. 400을 주면 어느 칸이 덫인지 알려주는 꼴이라,
  // 다음 시도에서 그 칸만 비우고 들어온다.
  if (looksLikeBot(json)) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const v = validateReportInput(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const { kind, placeId, body, contact } = v.value;

  // 특선 제보와 같은 이유의 속도 제한 — 서버리스 인스턴스는 메모리를 공유하지 않는다.
  // 다만 여기엔 세션이 없어서 사람별로 셀 수가 없다. created_at 만 보고 전역으로
  // 센다. 사람이 몰리면 애먼 사람이 막히지만, 접수는 다시 눌러도 되는 일이라
  // 그 손해가 어드민 받은함이 도배당하는 것보다 싸다.
  const [{ recent }] = await sql`
    SELECT count(*)::int AS recent FROM reports
    WHERE created_at > now() - interval '1 minute'`;
  if (recent >= 5) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  // status 는 기본값 'open' 그대로 둔다 — 접수와 처리는 어드민이 가르는 일이다.
  await sql`
    INSERT INTO reports (kind, place_id, body, contact)
    VALUES (${kind}, ${placeId}, ${body}, ${contact})`;
  return NextResponse.json({ ok: true }, { status: 201 });
}
