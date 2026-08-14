import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";

type CrawlRun = {
  startedAt: string;
  finishedAt: string;
  districts: string[];
  codes: string[];
  crawled: number;
  matched: number;
  unresolved: number;
  outOfRadius: number;
  duplicates: number;
};

const HISTORY_PATH = path.join(process.cwd(), "collector-runs.json");

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx.ok) return ctx.response;

  let runs: CrawlRun[] = [];
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    runs = JSON.parse(raw) as CrawlRun[];
  } catch {
    runs = [];
  }
  runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));

  return NextResponse.json({ runs });
}
