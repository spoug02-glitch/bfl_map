import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export type AdminRole = "super_admin" | "operator";
export type AdminSession = { adminId: number; role: AdminRole };

export const ADMIN_SESSION_COOKIE = "bfl_admin_session";
const TWELVE_HOURS_SEC = 60 * 60 * 12;

export const adminSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TWELVE_HOURS_SEC,
};

function secretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be set (>=32 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminSessionToken(adminId: number, role: AdminRole): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(adminId))
    .setIssuedAt()
    .setExpirationTime(`${TWELVE_HOURS_SEC}s`)
    .sign(secretKey());
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    const adminId = Number(payload.sub);
    if (!Number.isInteger(adminId)) return null;
    if (payload.role !== "super_admin" && payload.role !== "operator") return null;
    return { adminId, role: payload.role };
  } catch {
    return null;
  }
}

type AdminContext =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

/** `/api/admin/*`의 auth/login을 뺀 모든 라우트가 맨 앞에서 부른다. */
export async function requireAdmin(
  req: NextRequest,
  opts: { requireRole?: "super_admin" } = {},
): Promise<AdminContext> {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  // Check if admin is still active in the DB (immediately revoked if deactivated)
  const [adminRow] = await sql`SELECT is_active FROM admin_users WHERE id = ${session.adminId}`;
  if (!adminRow || !adminRow.is_active) {
    return { ok: false, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  if (opts.requireRole === "super_admin" && session.role !== "super_admin") {
    return { ok: false, response: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true, session };
}
