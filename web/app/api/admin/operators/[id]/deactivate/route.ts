import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req, { requireRole: "super_admin" });
  if (!ctx.ok) return ctx.response;
  const { id: rawId } = await params;
  const targetId = Number(rawId);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  if (targetId === ctx.session.adminId) {
    return NextResponse.json({ error: "본인 계정은 비활성화할 수 없습니다." }, { status: 400 });
  }

  const [target] = await sql`SELECT role, is_active FROM admin_users WHERE id = ${targetId}`;
  if (!target) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  if (target.role === "super_admin" && target.is_active) {
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM admin_users WHERE role = 'super_admin' AND is_active = true`;
    if (count <= 1) {
      return NextResponse.json({ error: "마지막 최고관리자는 비활성화할 수 없습니다." }, { status: 400 });
    }
  }

  await sql`UPDATE admin_users SET is_active = false WHERE id = ${targetId}`;
  return NextResponse.json({ ok: true });
}
