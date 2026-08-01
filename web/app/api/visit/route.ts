import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isValidVisitorId } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const visitorId = (json as Record<string, unknown> | null)?.visitorId;
  if (!isValidVisitorId(visitorId)) {
    return NextResponse.json({ error: "잘못된 방문자 ID입니다." }, { status: 400 });
  }
  await sql`
    INSERT INTO visits (visitor_id, day) VALUES (${visitorId as string}, CURRENT_DATE)
    ON CONFLICT DO NOTHING`;
  return new NextResponse(null, { status: 204 });
}
