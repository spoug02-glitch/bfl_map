import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { sql } from "@/lib/db";

/**
 * 검토 대기 중인 것 전부. 열린 제보와 승인 대기 업주 메뉴를 한 번에 준다.
 *
 * 두 목록을 따로 부르지 않는 이유: 어드민이 보는 건 "지금 내가 처리할 게 있나"
 * 하나뿐이라, 나눠 부르면 화면이 두 번 깜빡이고 배지 숫자도 두 번 계산해야 한다.
 *
 * 업주 메뉴는 가게별로 묶어서 준다. 한 번 제출에 여러 줄이 들어오는데 줄 단위로
 * 승인하게 두면 같은 가게의 메뉴가 반쯤 확정된 상태가 생긴다.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;

  const reports = await sql`
    SELECT id, kind, place_id, body, contact, created_at
    FROM reports WHERE status = 'open'
    ORDER BY created_at DESC LIMIT 200`;

  const ownerMenus = await sql`
    SELECT place_id,
           min(collected_at) AS submitted_at,
           min(source_ref)   AS contact,
           count(*)::int     AS item_count,
           json_agg(json_build_object('id', id, 'menuName', menu_name, 'price', price)
                    ORDER BY id) AS items
    FROM menu_items
    WHERE source_type = 'owner' AND status = 'pending'
    GROUP BY place_id
    ORDER BY min(collected_at) DESC
    LIMIT 100`;

  return NextResponse.json({ reports, ownerMenus });
}

type Action = { target: "report" | "ownerMenu"; decision: "approve" | "reject" };

function parseAction(json: unknown): (Action & { id?: number; placeId?: string }) | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  const target = o.target === "report" || o.target === "ownerMenu" ? o.target : null;
  const decision = o.decision === "approve" || o.decision === "reject" ? o.decision : null;
  if (!target || !decision) return null;
  return {
    target,
    decision,
    id: typeof o.id === "number" ? o.id : undefined,
    placeId: typeof o.placeId === "string" ? o.placeId : undefined,
  };
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const action = parseAction(json);
  if (!action) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  if (action.target === "report") {
    if (action.id === undefined) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    // 이미 처리된 건을 다시 바꾸지 않는다 — 두 운영자가 같은 건을 동시에 열었을 때
    // 나중 사람의 판단이 앞사람 것을 조용히 덮으면 안 된다.
    const rows = await sql`
      UPDATE reports
      SET status = ${action.decision === "approve" ? "handled" : "rejected"},
          handled_at = now(), handled_by = ${ctx.session.adminId}
      WHERE id = ${action.id} AND status = 'open'
      RETURNING id`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "이미 처리된 건입니다." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action.placeId === undefined) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  // 한 가게의 제출분은 통째로 승인하거나 통째로 물린다. 줄 단위로 가르면 같은
  // 가게의 메뉴가 반은 확정, 반은 미확인인 상태가 화면에 남는다.
  //
  // 승인 시각을 verified_at 에 적는다 — 스펙이 정한 대로 "확인 주체가 확인한 시각"
  // 이고, 업주 제출에서 그 주체는 승인한 운영자다.
  const rows = await sql`
    UPDATE menu_items
    SET status = ${action.decision === "approve" ? "published" : "rejected"},
        verified_at = ${action.decision === "approve" ? new Date().toISOString() : null}
    WHERE place_id = ${action.placeId} AND source_type = 'owner' AND status = 'pending'
    RETURNING id`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "이미 처리된 건입니다." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
