import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validatePlaceId } from "@/lib/lunch-closed";
import { PLACE_ID_RE } from "@/lib/constants";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

async function currentUserId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  return session?.userId ?? null;
}

const unauthorized = () =>
  NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

/**
 * 가게별 "점심에 안 열어요" 제보 수 전부, 그리고 (로그인했다면) 내가 누른 가게들.
 *
 * 가게별 왕복이 아니라 한 번에 내려준다 — 필터는 지도 위의 모든 가게를 동시에
 * 봐야 해서 가게마다 물어볼 수가 없다. 특선 요약(/api/specials)과 같은 이유다.
 * 제보가 붙은 가게만 나오므로 목록은 전체 5,800곳이 아니라 그중 일부다.
 */
export async function GET(req: NextRequest) {
  const userId = await currentUserId(req);
  const rows = await sql`
    SELECT place_id, count(*)::int AS reports
    FROM lunch_closed_reports GROUP BY place_id`;
  const counts = rows.map(r => ({ place_id: r.place_id, reports: r.reports }));
  if (!userId) return NextResponse.json({ counts, mine: [] });
  const own = await sql`
    SELECT place_id FROM lunch_closed_reports WHERE user_id = ${userId}`;
  return NextResponse.json({ counts, mine: own.map(r => r.place_id) });
}

export async function POST(req: NextRequest) {
  const userId = await currentUserId(req);
  if (!userId) return unauthorized();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const v = validatePlaceId(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // 특선 제보와 같은 이유의 속도 제한 — 서버리스 인스턴스는 메모리를 공유하지
  // 않으니 DB에서 센다. 여기서는 더 조인다: 이건 가게를 **빼는** 제보라,
  // 한 계정이 훑으면서 동네를 지울 수 있으면 안 된다.
  const [{ recent, hasUser }] = await sql`
    SELECT
      (SELECT count(*)::int FROM lunch_closed_reports
        WHERE user_id = ${userId} AND created_at > now() - interval '1 minute') AS recent,
      EXISTS (SELECT 1 FROM users WHERE user_id = ${userId}) AS "hasUser"`;
  if (!hasUser) {
    return NextResponse.json({ error: "닉네임을 먼저 설정해주세요." }, { status: 409 });
  }
  if (recent >= 3) {
    return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  // 한 사람은 한 가게에 한 표다. 두 번 눌러도 제보 수가 늘지 않는다.
  await sql`
    INSERT INTO lunch_closed_reports (place_id, user_id) VALUES (${v.placeId}, ${userId})
    ON CONFLICT (place_id, user_id) DO NOTHING`;
  return NextResponse.json({ reported: true }, { status: 201 });
}

/** 잘못 눌렀거나, 가게가 점심 영업을 다시 시작한 경우. 되돌릴 길이 없으면 안 된다. */
export async function DELETE(req: NextRequest) {
  const userId = await currentUserId(req);
  if (!userId) return unauthorized();
  const placeId = req.nextUrl.searchParams.get("placeId") ?? "";
  if (!PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ error: "잘못된 가게 ID입니다." }, { status: 400 });
  }
  await sql`
    DELETE FROM lunch_closed_reports WHERE user_id = ${userId} AND place_id = ${placeId}`;
  return NextResponse.json({ reported: false });
}
