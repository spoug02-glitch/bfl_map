import { beforeAll, describe, expect, it } from "vitest";
import { namespacedUserId } from "@/lib/session";

beforeAll(() => {
  process.env.KAKAO_REST_API_KEY = "test-rest-key";
});

describe("kakao buildAuthorizeUrl", () => {
  it("builds the kauth url with redirect, scope, and state", async () => {
    const { buildAuthorizeUrl } = await import("@/lib/kakao-auth");
    const url = new URL(buildAuthorizeUrl("https://example.com", "st4te"));
    expect(url.origin).toBe("https://kauth.kakao.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-rest-key");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/auth/kakao/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("profile_nickname");
    expect(url.searchParams.get("state")).toBe("st4te");
  });
});

describe("namespacedUserId", () => {
  it("keeps identical account ids from different providers apart", () => {
    // a Kakao id and a Google sub could otherwise collide and let one person
    // overwrite another's review, since (place_id, user_id) identifies a review
    expect(namespacedUserId("kakao", "12345")).not.toBe(namespacedUserId("google", "12345"));
    expect(namespacedUserId("kakao", "12345")).toBe("kakao:12345");
    expect(namespacedUserId("google", "12345")).toBe("google:12345");
  });
});
