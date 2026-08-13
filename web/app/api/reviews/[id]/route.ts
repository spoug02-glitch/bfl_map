import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { kstDateTime } from "@/lib/kst";
import { suspensionNotice } from "@/lib/legal";
import { validateReviewBody } from "@/lib/reviews";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isPermanentSuspension } from "@/lib/suspension";
import { isSuspended } from "@/lib/suspension-server";

const REVIEW_ID_RE = /^\d{1,19}$/;

type Params = { params: Promise<{ id: string }> };

/**
 * `ok`를 판별 필드로 둔다. 이게 없으면 TypeScript가 두 반환 객체를 합치면서
 * 없는 쪽 속성을 `error?: undefined`로 채워, `"error" in ctx` 검사가 좁히지 못한다.
 * 그러면 핸들러 반환 타입에 undefined가 섞여 들어간다.
 */
type OwnerContext =
  | { ok: false; response: NextResponse }
  | { ok: true; id: string; userId: string };

async function requireOwnerContext(req: NextRequest, rawId: string): Promise<OwnerContext> {
  if (!REVIEW_ID_RE.test(rawId)) {
    return { ok: false, response: NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 }) };
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  return { ok: true, id: rawId, userId: session.userId };
}

/**
 * 소유권은 WHERE 절이 판정한다 — 남의 리뷰를 지정하면 갱신되는 행이 0개다.
 * 따로 SELECT해서 비교하면 그 사이에 끼어들 틈이 생기고, 남의 리뷰가 "존재한다"는
 * 사실만 알려주는 응답을 내보내기도 쉽다. 둘 다 404로 답한다.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await requireOwnerContext(req, id);
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const v = validateReviewBody(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const suspension = await isSuspended(ctx.userId);
  if (suspension.suspended) {
    const until = suspension.until!;
    const notice = suspensionNotice(isPermanentSuspension(until) ? null : kstDateTime(until));
    return NextResponse.json({ error: notice }, { status: 403 });
  }

  // created_at은 그대로 둔다 — 방문 시점은 바뀌지 않았고, 7일 쿨다운도 그 값을 본다.
  const rows = await sql`
    UPDATE reviews
    SET taste = ${v.value.taste}, convenience = ${v.value.convenience},
        body = ${v.value.body}, updated_at = now()
    WHERE id = ${ctx.id} AND user_id = ${ctx.userId}
    RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ctx = await requireOwnerContext(req, id);
  if (!ctx.ok) return ctx.response;

  const rows = await sql`
    DELETE FROM reviews WHERE id = ${ctx.id} AND user_id = ${ctx.userId} RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
