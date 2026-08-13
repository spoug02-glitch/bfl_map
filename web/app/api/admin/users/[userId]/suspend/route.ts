import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";
import { durationToSuspendedUntil, isValidDurationLabel } from "@/lib/suspension";

type Params = { params: Promise<{ userId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const { userId } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  if (!isValidDurationLabel(o.duration)) {
    return NextResponse.json({ error: "정지 기간이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof o.reason !== "string" || o.reason.trim().length === 0) {
    return NextResponse.json({ error: "정지 사유를 입력해주세요." }, { status: 400 });
  }

  const [target] = await sql`SELECT user_id FROM users WHERE user_id = ${userId}`;
  if (!target) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const suspendedUntil = durationToSuspendedUntil(o.duration);
  const reason = o.reason.trim();
  await sql.transaction([
    sql`UPDATE users SET suspended_until = ${suspendedUntil} WHERE user_id = ${userId}`,
    sql`
      INSERT INTO user_suspensions (user_id, admin_id, reason, duration_label, suspended_until)
      VALUES (${userId}, ${ctx.session.adminId}, ${reason}, ${o.duration}, ${suspendedUntil})`,
  ]);

  return NextResponse.json({ ok: true, suspendedUntil: suspendedUntil.toISOString() });
}
