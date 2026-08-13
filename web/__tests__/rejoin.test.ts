import { beforeAll, describe, expect, it } from "vitest";
import { REJOIN_BLOCK_DAYS, withdrawalFingerprint } from "@/lib/rejoin";

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-at-least-32-chars-long!!";
});

describe("withdrawalFingerprint", () => {
  it("같은 계정은 언제 계산해도 같은 값이다", () => {
    expect(withdrawalFingerprint("kakao:123")).toBe(withdrawalFingerprint("kakao:123"));
  });

  it("다른 계정은 다른 값이다", () => {
    expect(withdrawalFingerprint("kakao:123")).not.toBe(withdrawalFingerprint("kakao:124"));
  });

  // 이 표가 새더라도 카카오 회원번호가 드러나면 안 된다.
  it("원래 값이 결과에 남지 않는다", () => {
    const fp = withdrawalFingerprint("kakao:987654321");
    expect(fp).not.toContain("987654321");
    expect(fp).not.toContain("kakao");
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("비밀이 없으면 조용히 넘어가지 않는다", () => {
    const saved = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      expect(() => withdrawalFingerprint("kakao:123")).toThrow(/SESSION_SECRET/);
    } finally {
      process.env.SESSION_SECRET = saved;
    }
  });

  // 리뷰 쿨다운과 같아야 왕복해서 얻는 것이 없다.
  it("차단 기간이 리뷰 쿨다운과 같다", () => {
    expect(REJOIN_BLOCK_DAYS).toBe(7);
  });
});
