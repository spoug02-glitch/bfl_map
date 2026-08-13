import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ userId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const { userId } = await params;

  const [target] = await sql`SELECT user_id FROM users WHERE user_id = ${userId}`;
  if (!target) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  await sql.transaction([
    sql`UPDATE users SET suspended_until = NULL WHERE user_id = ${userId}`,
    sql`
      UPDATE user_suspensions SET lifted_at = now(), lifted_by = ${ctx.session.adminId}
      WHERE user_id = ${userId} AND lifted_at IS NULL AND suspended_until > now()`,
  ]);

  return NextResponse.json({ ok: true });
}
