import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

function isDuplicateUsername(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, { requireRole: "super_admin" });
  if (!ctx.ok) return ctx.response;
  const operators = await sql`
    SELECT id, username, role, is_active, created_at FROM admin_users ORDER BY created_at ASC`;
  return NextResponse.json({ operators });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, { requireRole: "super_admin" });
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  if (typeof o.username !== "string" || o.username.trim().length < 3) {
    return NextResponse.json({ error: "아이디는 3자 이상이어야 합니다." }, { status: 400 });
  }
  if (typeof o.password !== "string" || o.password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (o.role !== "super_admin" && o.role !== "operator") {
    return NextResponse.json({ error: "등급이 올바르지 않습니다." }, { status: 400 });
  }

  const passwordHash = await hashPassword(o.password);
  try {
    const [row] = await sql`
      INSERT INTO admin_users (username, password_hash, role, created_by)
      VALUES (${o.username.trim()}, ${passwordHash}, ${o.role}, ${ctx.session.adminId})
      RETURNING id`;
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (e) {
    if (isDuplicateUsername(e)) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
    throw e;
  }
}
