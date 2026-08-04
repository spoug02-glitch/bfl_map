import { SignJWT, jwtVerify } from "jose";

/** 세션이 들고 다니는 전부. 표시 이름은 여기 없고 users 테이블에서 읽는다. */
export type Session = { userId: string };

export type AuthProvider = "kakao";

/**
 * Namespaces an account id by its provider.
 *
 * Kakao is the only provider now — Google login was removed because two
 * providers meant one person could hold two accounts and review the same
 * place twice. The prefix stays anyway: rows written during the Google era
 * still carry `google:`, and a second provider can only ever be added safely
 * if ids are namespaced. Raw ids would risk two people colliding on one id,
 * and a collision would let one edit the other's review, since
 * (place_id, user_id) is the review's primary identity.
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

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SEVEN_DAYS_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    // sub만 요구한다. 배포 전에 발급된 토큰에는 nickname 클레임이 남아 있는데,
    // 그걸 무시하고 통과시켜야 기존 로그인 사용자가 강제로 로그아웃되지 않는다.
    if (typeof payload.sub !== "string" || payload.sub === "") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
