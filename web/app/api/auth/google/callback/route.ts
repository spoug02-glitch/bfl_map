import { NextRequest, NextResponse } from "next/server";
import { exchangeToken, fetchGoogleUser } from "@/lib/google-auth";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

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
    const user = await fetchGoogleUser(token);
    const res = NextResponse.redirect(`${base}/`);
    res.cookies.set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions);
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (e) {
    console.error("google callback failed:", e);
    return NextResponse.redirect(`${base}/?login_error=google`);
  }
}
