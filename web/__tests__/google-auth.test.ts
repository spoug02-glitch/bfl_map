import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
});

describe("buildAuthorizeUrl", () => {
  it("builds google authorize url with redirect, scope, and state", async () => {
    const { buildAuthorizeUrl } = await import("@/lib/google-auth");
    const url = new URL(buildAuthorizeUrl("http://localhost:3000", "st4te"));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id.apps.googleusercontent.com");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid profile");
    expect(url.searchParams.get("state")).toBe("st4te");
  });
});
