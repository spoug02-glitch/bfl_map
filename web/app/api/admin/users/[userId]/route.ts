import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

type Params = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;
  const { userId } = await params;

  const [user] = await sql`
    SELECT u.user_id, u.nickname, u.created_at, u.suspended_until,
           (SELECT count(*)::int FROM reviews r WHERE r.user_id = u.user_id) AS "reviewCount"
    FROM users u WHERE u.user_id = ${userId}`;
  if (!user) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const recentReviews = await sql`
    SELECT id, place_id, taste, convenience, body, created_at
    FROM reviews WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 5`;

  const history = await sql`
    SELECT s.id, s.reason, s.duration_label, s.suspended_until, s.created_at,
           s.lifted_at, a.username AS "adminUsername"
    FROM user_suspensions s JOIN admin_users a ON a.id = s.admin_id
    WHERE s.user_id = ${userId}
    ORDER BY s.created_at DESC LIMIT 50`;

  return NextResponse.json({ user, recentReviews, history });
}
