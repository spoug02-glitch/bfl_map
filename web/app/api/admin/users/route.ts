import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(raw: string | null): number {
  const n = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  const n = raw ? Number(raw) : 0;
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));
  const pattern = `%${q}%`;

  // q가 비어 있으면 첫 항을 true로 만들어 조건 없이 최신순 페이지네이션만 돈다.
  const users = await sql`
    SELECT user_id, nickname, created_at, suspended_until
    FROM users
    WHERE ${q === ""} OR nickname ILIKE ${pattern} OR user_id ILIKE ${pattern}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}`;

  return NextResponse.json({ users, limit, offset });
}
