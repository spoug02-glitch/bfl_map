import { describe, expect, it } from "vitest";
import { PRICE_AGREEMENT_RATIO, dbMinPrice, pricesAgree, sourceLabel } from "@/lib/menu-source";
import type { DbMenuItem } from "@/lib/menu-source";

const item = (o: Partial<DbMenuItem>): DbMenuItem => ({
  menuName: "김치찌개",
  price: 9000,
  sourceType: "user_report",
  status: "published",
  verifiedAt: null,
  ...o,
});

describe("pricesAgree", () => {
  it("같은 값은 일치한다", () => {
    expect(pricesAgree(10000, 10000)).toBe(true);
  });

  it("작은 쪽 기준 ±20% 안쪽은 일치한다", () => {
    expect(pricesAgree(10000, 12000)).toBe(true);
    expect(pricesAgree(10000, 9000)).toBe(true);
  });

  // 큰 쪽 기준이었다면 딱 경계에 걸려 통과했을 쌍. 작은 쪽 기준이라 탈락한다.
  it("8,000과 10,000은 뒷받침으로 보지 않는다", () => {
    expect(pricesAgree(10000, 8000)).toBe(false);
  });

  it("경계 밖은 일치하지 않는다", () => {
    expect(pricesAgree(10000, 12001)).toBe(false);
    expect(pricesAgree(10000, 7999)).toBe(false);
  });

  // 대칭성은 min/max 어느 쪽을 기준으로 삼든 성립한다. 그래도 고정해 두는 이유는
  // 나중에 "첫 인자 기준"처럼 비대칭 구현으로 바뀌면 같은 두 제보가 저장 순서에 따라
  // 확정되기도 하고 안 되기도 하기 때문이다.
  it("인자 순서를 바꿔도 같은 답이 나온다", () => {
    expect(pricesAgree(8000, 10000)).toBe(pricesAgree(10000, 8000));
    expect(pricesAgree(8000, 10000)).toBe(false);
  });

  it("비율 상수가 스펙과 같다", () => {
    expect(PRICE_AGREEMENT_RATIO).toBe(0.2);
  });
});

describe("dbMinPrice", () => {
  it("항목이 없으면 null", () => {
    expect(dbMinPrice([])).toBeNull();
  });

  it("published 중 최저가를 고른다", () => {
    expect(dbMinPrice([item({ price: 12000 }), item({ price: 8000 })])).toBe(8000);
  });

  // 확정되지 않은 한 사람의 제보가 가격 필터를 통과시키면 status 컬럼을 만든 이유가 없어진다.
  it("pending 은 세지 않는다", () => {
    expect(dbMinPrice([item({ price: 5000, status: "pending" }), item({ price: 9000 })])).toBe(9000);
  });

  it("rejected 는 세지 않는다", () => {
    expect(dbMinPrice([item({ price: 100, status: "rejected" })])).toBeNull();
  });

  it("가격 없는 항목(NULL)은 건너뛴다", () => {
    expect(dbMinPrice([item({ price: null }), item({ price: 7000 })])).toBe(7000);
  });

  it("가격이 전부 NULL이면 null", () => {
    expect(dbMinPrice([item({ price: null })])).toBeNull();
  });

  it("0이나 음수는 가격으로 치지 않는다", () => {
    expect(dbMinPrice([item({ price: 0 }), item({ price: -1 })])).toBeNull();
  });
});

describe("sourceLabel", () => {
  it("다섯 출처 모두 라벨이 있다", () => {
    for (const t of [
      "public_data",
      "owner",
      "user_report",
      "official_source",
      "legacy_import",
    ] as const) {
      expect(sourceLabel(t).length).toBeGreaterThan(0);
    }
  });

  it("업주 제공과 이용자 제보는 다른 말로 표시된다", () => {
    expect(sourceLabel("owner")).not.toBe(sourceLabel("user_report"));
  });
});
