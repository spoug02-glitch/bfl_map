import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long!!";
});

describe("session token", () => {
  it("round-trips a user", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await createSessionToken({ userId: "google-sub-42", nickname: "피곤한직장인" });
    const user = await verifySessionToken(token);
    expect(user).toEqual({ userId: "google-sub-42", nickname: "피곤한직장인" });
  });

  it("rejects a tampered token", async () => {
    const { createSessionToken, verifySessionToken } = await import("@/lib/session");
    const token = await createSessionToken({ userId: "42", nickname: "a" });
    expect(await verifySessionToken(token + "x")).toBeNull();
  });
});
