import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const [{ dau, wau, mau }] = await sql`
    SELECT
      (SELECT count(*)::int FROM visits WHERE day = CURRENT_DATE) AS dau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 7) AS wau,
      (SELECT count(DISTINCT visitor_id)::int FROM visits WHERE day > CURRENT_DATE - 30) AS mau`;
  return NextResponse.json({ dau, wau, mau, asOf: new Date().toISOString() });
}
