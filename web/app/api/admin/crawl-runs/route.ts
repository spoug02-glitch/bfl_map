import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";

/**
 * 여기서는 정렬만 하고 그대로 흘려보낸다. 실행 기록은 collect.py 가 쓰는 모양이
 * 정답이고, 2026-08-27 인허가 전환으로 필드가 통째로 바뀌었다 — 그때 이 타입이
 * 옛 모양에 멈춰 있어서 어드민 표가 새 실행을 `undefined` 로 그렸다. 필드를
 * 여기 나열하지 않는 이유가 그것이다. 읽는 쪽(AdminDashboard)이 `source` 로 가른다.
 */
type CrawlRun = { startedAt: string };

const HISTORY_PATH = path.join(process.cwd(), "collector-runs.json");

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;

  let runs: CrawlRun[] = [];
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) runs = parsed as CrawlRun[];
  } catch {
    runs = [];
  }
  runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));

  return NextResponse.json({ runs });
}
