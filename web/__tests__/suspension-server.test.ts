import { beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: sqlMock }));

beforeEach(() => {
  sqlMock.mockReset();
});

describe("isSuspended", () => {
  it("reports not suspended when suspended_until is null", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: null }]);
    const { isSuspended } = await import("@/lib/suspension-server");
    await expect(isSuspended("kakao:1")).resolves.toEqual({ suspended: false, until: null });
  });

  it("reports not suspended when suspended_until is in the past", async () => {
    sqlMock.mockResolvedValueOnce([{ suspended_until: new Date(Date.now() - 60_000).toISOString() }]);
    const { isSuspended } = await import("@/lib/suspension-server");
    await expect(isSuspended("kakao:1")).resolves.toEqual({ suspended: false, until: null });
  });

  it("reports suspended with the expiry when suspended_until is in the future", async () => {
    const until = new Date(Date.now() + 60_000);
    sqlMock.mockResolvedValueOnce([{ suspended_until: until.toISOString() }]);
    const { isSuspended } = await import("@/lib/suspension-server");
    const result = await isSuspended("kakao:1");
    expect(result.suspended).toBe(true);
    expect(result.until?.getTime()).toBe(until.getTime());
  });

  it("reports not suspended when the user row doesn't exist", async () => {
    sqlMock.mockResolvedValueOnce([]);
    const { isSuspended } = await import("@/lib/suspension-server");
    await expect(isSuspended("kakao:ghost")).resolves.toEqual({ suspended: false, until: null });
  });
});
