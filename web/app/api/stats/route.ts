import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Returns 404 (not 401/403) for both "no admin configured" and "not the
// admin" so the endpoint's existence isn't advertised to non-admins.
export async function GET(req: NextRequest) {
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  if (!user || user.userId !== adminUserId) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  const [{ dau, wau, mau }] = await sql`
    SELECT
      (SELECT count(*)::int FROM visits WHERE day = CURRENT_DATE) AS dau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 7) AS wau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 30) AS mau`;
  return NextResponse.json({ dau, wau, mau, asOf: new Date().toISOString() });
}
