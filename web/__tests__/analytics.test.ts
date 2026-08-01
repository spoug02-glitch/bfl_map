import { describe, expect, it } from "vitest";
import { isValidVisitorId, shouldPing } from "@/lib/analytics";

describe("isValidVisitorId", () => {
  it("accepts a UUID", () => {
    expect(isValidVisitorId("110e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts a 32-char token", () => {
    expect(isValidVisitorId("a".repeat(32))).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidVisitorId("")).toBe(false);
  });

  it("rejects a 500-char string", () => {
    expect(isValidVisitorId("a".repeat(500))).toBe(false);
  });

  it("rejects SQL-ish input", () => {
    expect(isValidVisitorId("'; DROP TABLE visits;--")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidVisitorId(12345)).toBe(false);
    expect(isValidVisitorId(null)).toBe(false);
    expect(isValidVisitorId(undefined)).toBe(false);
    expect(isValidVisitorId({})).toBe(false);
  });
});

describe("shouldPing", () => {
  const today = new Date("2026-08-01T15:00:00");

  it("returns true when never pinged", () => {
    expect(shouldPing(null, today)).toBe(true);
  });

  it("returns true when the last ping was yesterday", () => {
    expect(shouldPing("2026-07-31T23:59:00", today)).toBe(true);
  });

  it("returns false when the last ping was earlier today", () => {
    expect(shouldPing("2026-08-01T09:00:00", today)).toBe(false);
  });
});
