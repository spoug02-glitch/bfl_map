import { describe, expect, it } from "vitest";
import { PRICE_LIMITS, effectiveMinPrice, priceLimitLabel } from "@/lib/constants";
import { dbMinPrice } from "@/lib/menu-source";
import type { DbMenuItem } from "@/lib/menu-source";

describe("priceLimitLabel", () => {
  it("상한 선택지와 라벨", () => {
    expect(PRICE_LIMITS).toContain(10000);
    expect(priceLimitLabel(5000)).toBe("5천원 이하");
    expect(priceLimitLabel(8000)).toBe("8천원 이하");
    expect(priceLimitLabel(10000)).toBe("1만원 이하");
    expect(priceLimitLabel(15000)).toBe("1.5만원 이하");
    expect(priceLimitLabel(20000)).toBe("2만원 이하");
  });
});

describe("effectiveMinPrice", () => {
  const db = (price: number | null, status: DbMenuItem["status"] = "published"): DbMenuItem => ({
    menuName: "메뉴", price, sourceType: "user_report", status, verifiedAt: null,
  });

  it("특선 제보만 있으면 그 값이 최저가다", () => {
    expect(effectiveMinPrice({ menuName: "특선", price: 10000 })).toBe(10000);
  });

  it("특선도 DB도 없으면 null", () => {
    expect(effectiveMinPrice(undefined)).toBeNull();
  });

  it("DB 메뉴만 있으면 그 값이 최저가다", () => {
    expect(effectiveMinPrice(undefined, [db(7000)])).toBe(7000);
  });

  // 오스시 사례: DB 최저가 17,000이어도 1만원 특선 제보가 있으면 그게 최저가다.
  it("특선과 DB가 함께 있으면 둘 중 싼 쪽이다", () => {
    expect(effectiveMinPrice({ menuName: "특선", price: 10000 }, [db(17000)])).toBe(10000);
    expect(effectiveMinPrice({ menuName: "특선", price: 19000 }, [db(17000)])).toBe(17000);
  });

  it("DB에 pending만 있으면 가격이 없는 것으로 본다", () => {
    expect(effectiveMinPrice(undefined, [db(3000, "pending")])).toBeNull();
  });

  it("dbMinPrice와 같은 판정을 쓴다", () => {
    const items = [db(5000, "rejected"), db(9000)];
    expect(effectiveMinPrice(undefined, items)).toBe(dbMinPrice(items));
  });
});
