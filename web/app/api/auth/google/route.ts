import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/google-auth";

export function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;

  // A Vercel project answers on several hostnames, and the state cookie must be
  // written on the host the callback will actually be served from, not on
  // whichever alias the visitor used.
  if (process.env.NEXT_PUBLIC_BASE_URL && req.nextUrl.origin !== base) {
    return NextResponse.redirect(`${base}${req.nextUrl.pathname}`);
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(base, state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
