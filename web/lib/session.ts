import { SignJWT, jwtVerify } from "jose";

export type SessionUser = { userId: string; nickname: string };

export type AuthProvider = "google" | "kakao";

/**
 * Namespaces an account id by its provider.
 *
 * Google subs and Kakao ids are both opaque numeric-ish strings from separate
 * systems, so storing them raw in reviews.user_id risks two different people
 * colliding on one id — and a collision would let one person edit the other's
 * review, since (place_id, user_id) is the review's primary identity.
 */
export function namespacedUserId(provider: AuthProvider, accountId: string): string {
  return `${provider}:${accountId}`;
}

export const SESSION_COOKIE = "bfl_session";
const SEVEN_DAYS_SEC = 60 * 60 * 24 * 7;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SEVEN_DAYS_SEC,
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set (>=32 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ nickname: user.nickname })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${SEVEN_DAYS_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.nickname !== "string") return null;
    return { userId: payload.sub, nickname: payload.nickname };
  } catch {
    return null;
  }
}
