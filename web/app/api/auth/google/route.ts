import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/google-auth";

export function GET(req: NextRequest) {
  const state = crypto.randomUUID();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
  const res = NextResponse.redirect(buildAuthorizeUrl(base, state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
