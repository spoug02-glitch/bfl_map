import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  // 재방문 지표 둘은 WAU와 같은 7일 창을 쓴다 — 창이 다르면 "22명 중 몇 명"
  // 처럼 나란히 읽을 수 없다. 둘은 서로 다른 것을 센다: weeklyRepeat은 이번
  // 주에 여러 날 온 사람(습관), weeklyReturning은 이 주 이전에도 온 적이 있는
  // 사람(신규가 아님).
  const [{ dau, wau, mau, weeklyRepeat, weeklyReturning }] = await sql`
    SELECT
      (SELECT count(*)::int FROM visits WHERE day = CURRENT_DATE) AS dau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 7) AS wau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 30) AS mau,
      (SELECT count(*)::int FROM (
         SELECT visitor_id FROM visits WHERE day > CURRENT_DATE - 7
         GROUP BY visitor_id HAVING count(*) >= 2) t) AS "weeklyRepeat",
      (SELECT count(*)::int FROM (
         SELECT DISTINCT visitor_id FROM visits WHERE day > CURRENT_DATE - 7) w
       WHERE EXISTS (SELECT 1 FROM visits o
         WHERE o.visitor_id = w.visitor_id AND o.day <= CURRENT_DATE - 7)) AS "weeklyReturning"`;
  return NextResponse.json({
    dau, wau, mau, weeklyRepeat, weeklyReturning, asOf: new Date().toISOString(),
  });
}
