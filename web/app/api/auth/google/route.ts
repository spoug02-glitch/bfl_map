import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/google-auth";

export function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;

  // A Vercel project answers on several hostnames. If the visitor started on an
  // alias, the state cookie would be written to that host while the provider
  // returns to NEXT_PUBLIC_BASE_URL, where the cookie does not exist — a single
  // honest login attempt would then fail the state check. Move them to the
  // canonical host first so the cookie is set where the callback will read it.
  if (process.env.NEXT_PUBLIC_BASE_URL && req.nextUrl.origin !== base) {
    return NextResponse.redirect(`${base}${req.nextUrl.pathname}`);
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(base, state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
