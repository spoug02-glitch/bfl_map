import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";

const SECRET = "test-secret-at-least-32-chars-long!!";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("session token", () => {
  it("round-trips a user id", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await createSessionToken("google:sub-42");
    expect(await verifySessionToken(token)).toEqual({ userId: "google:sub-42" });
  });

  it("does not carry a nickname claim", async () => {
    const { createSessionToken } = await import("@/lib/session");
    const token = await createSessionToken("kakao:99");
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    expect(payload.nickname).toBeUndefined();
  });

  it("still accepts an already-issued token that carries a nickname claim", async () => {
    // 배포 전에 발급된 세션을 강제 로그아웃시키지 않기 위한 호환 경로
    const legacy = await new SignJWT({ nickname: "본명" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("kakao:legacy")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(SECRET));
    const { verifySessionToken } = await import("@/lib/session");
    expect(await verifySessionToken(legacy)).toEqual({ userId: "kakao:legacy" });
  });

  it("rejects a tampered token", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await createSessionToken("42");
    expect(await verifySessionToken(token + "x")).toBeNull();
  });
});
