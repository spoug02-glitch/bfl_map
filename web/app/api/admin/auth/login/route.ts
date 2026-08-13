import { NextRequest, NextResponse } from "next/server";
import { normalizeUsername, verifyPassword, DUMMY_HASH } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionToken } from "@/lib/admin-session";
import { sql } from "@/lib/db";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  if (typeof o.username !== "string" || typeof o.password !== "string") {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const normalized = normalizeUsername(o.username);
  const [row] = await sql`
    SELECT id, password_hash, role, is_active, failed_attempts, locked_until
    FROM admin_users WHERE lower(trim(username)) = ${normalized}`;
  const invalid = () => NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });

  // Timing-safe check: run password verification even if user not found or inactive
  if (!row || !row.is_active) {
    await verifyPassword(o.password, DUMMY_HASH);
    return invalid();
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "로그인 시도가 많아 잠시 잠겼습니다. 15분 후 다시 시도해주세요." },
      { status: 423 },
    );
  }

  const valid = await verifyPassword(o.password, row.password_hash);
  if (!valid) {
    const attempts = row.failed_attempts + 1;
    const lockedUntil = attempts >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await sql`
      UPDATE admin_users SET failed_attempts = ${attempts}, locked_until = ${lockedUntil}
      WHERE id = ${row.id}`;
    return invalid();
  }

  await sql`UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ${row.id}`;
  const token = await createAdminSessionToken(row.id, row.role);
  const res = NextResponse.json({ ok: true, role: row.role });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions);
  return res;
}
