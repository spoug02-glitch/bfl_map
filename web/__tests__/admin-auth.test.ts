import { describe, expect, it } from "vitest";
import { hashPassword, normalizeUsername, verifyPassword } from "@/lib/admin-auth";

describe("hashPassword / verifyPassword", () => {
  it("produces the versioned scrypt format", async () => {
    const stored = await hashPassword("hunter2-but-longer");
    expect(stored).toMatch(/^scrypt:\d+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("verifies the correct password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false);
  });

  it("rejects a malformed stored value instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "bcrypt:10:x:y")).resolves.toBe(false);
  });

  it("produces a different salt each time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Ops_Lead  ")).toBe("ops_lead");
  });
});
