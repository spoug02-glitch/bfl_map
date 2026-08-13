import { sql } from "@/lib/db";

export type SuspensionStatus = { suspended: boolean; until: Date | null };

/** 글쓰기 라우트가 필요로 하는 전부. */
export async function isSuspended(userId: string): Promise<SuspensionStatus> {
  const [row] = await sql`SELECT suspended_until FROM users WHERE user_id = ${userId}`;
  const until = row?.suspended_until ? new Date(row.suspended_until) : null;
  if (!until || until.getTime() <= Date.now()) return { suspended: false, until: null };
  return { suspended: true, until };
}
