import { describe, expect, it } from "vitest";
import {
  PERMANENT_SUSPENSION_UNTIL,
  durationToSuspendedUntil,
  isPermanentSuspension,
  isSuspensionActive,
  isValidDurationLabel,
} from "@/lib/suspension";

const NOW = new Date("2026-08-13T00:00:00Z");

describe("durationToSuspendedUntil", () => {
  it("adds the right offset for each timed label", () => {
    expect(durationToSuspendedUntil("1h", NOW)).toEqual(new Date("2026-08-13T01:00:00Z"));
    expect(durationToSuspendedUntil("3h", NOW)).toEqual(new Date("2026-08-13T03:00:00Z"));
    expect(durationToSuspendedUntil("1d", NOW)).toEqual(new Date("2026-08-14T00:00:00Z"));
    expect(durationToSuspendedUntil("3d", NOW)).toEqual(new Date("2026-08-16T00:00:00Z"));
    expect(durationToSuspendedUntil("7d", NOW)).toEqual(new Date("2026-08-20T00:00:00Z"));
  });

  it("returns the permanent constant for 'permanent'", () => {
    expect(durationToSuspendedUntil("permanent", NOW)).toBe(PERMANENT_SUSPENSION_UNTIL);
  });
});

describe("isValidDurationLabel", () => {
  it("accepts the six known labels", () => {
    for (const l of ["1h", "3h", "1d", "3d", "7d", "permanent"]) {
      expect(isValidDurationLabel(l)).toBe(true);
    }
  });
  it("rejects anything else", () => {
    expect(isValidDurationLabel("2h")).toBe(false);
    expect(isValidDurationLabel(undefined)).toBe(false);
    expect(isValidDurationLabel(1)).toBe(false);
  });
});

describe("isPermanentSuspension / isSuspensionActive", () => {
  it("recognizes the permanent constant and nothing else", () => {
    expect(isPermanentSuspension(PERMANENT_SUSPENSION_UNTIL)).toBe(true);
    expect(isPermanentSuspension(new Date("9999-12-31T23:59:58Z"))).toBe(false);
  });

  it("treats a future date as active and a past date as inactive", () => {
    expect(isSuspensionActive(new Date(Date.now() + 60_000))).toBe(true);
    expect(isSuspensionActive(new Date(Date.now() - 60_000))).toBe(false);
  });

  it("treats null as inactive", () => {
    expect(isSuspensionActive(null)).toBe(false);
  });
});
