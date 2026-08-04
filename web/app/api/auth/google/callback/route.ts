import { NextRequest, NextResponse } from "next/server";
import { exchangeToken, fetchGoogleUser } from "@/lib/google-auth";
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
    const res = NextResponse.redirect(`${base}/`);
    res.cookies.set(
      SESSION_COOKIE,
      // account.nickname(구글 프로필 이름)은 쓰지 않고 버린다 — 대개 본명이다.
      await createSessionToken(namespacedUserId("google", account.userId)),
      sessionCookieOptions,
    );
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (e) {
    console.error("google callback failed:", e);
    return NextResponse.redirect(`${base}/?login_error=google`);
  }
}
