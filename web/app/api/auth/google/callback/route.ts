import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { exchangeToken, fetchGoogleUser } from "@/lib/google-auth";
import { REJOIN_BLOCK_DAYS, withdrawalFingerprint } from "@/lib/rejoin";
import {
  SESSION_COOKIE,
  createSessionToken,
  namespacedUserId,
  sessionCookieOptions,
} from "@/lib/session";

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("google_oauth_state")?.value;
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${base}/?login_error=state`);
  }
  try {
    const token = await exchangeToken(base, code);
    const account = await fetchGoogleUser(token);
    const userId = namespacedUserId("google", account.userId);

    // 이 표를 읽는 유일한 순간이라 만료된 행 청소도 여기서 겸한다.
    // 세션을 만들기 전에 확인한다 — 막을 거면 로그인 자체가 성립하면 안 된다.
    await sql`DELETE FROM withdrawals
              WHERE withdrawn_at < now() - make_interval(days => ${REJOIN_BLOCK_DAYS})`;
    const [blocked] = await sql`
      SELECT withdrawn_at FROM withdrawals WHERE fingerprint = ${withdrawalFingerprint(userId)}`;
    if (blocked) {
      return NextResponse.redirect(`${base}/?login_error=rejoin`);
    }

    const res = NextResponse.redirect(`${base}/`);
    res.cookies.set(SESSION_COOKIE, await createSessionToken(userId), sessionCookieOptions);
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (e) {
    console.error("google callback failed:", e);
    return NextResponse.redirect(`${base}/?login_error=google`);
  }
}
