import { describe, expect, it } from "vitest";
import { CHEAP_LIMIT, cheapestMenu, minMenuPrice } from "@/lib/constants";

const menu = (price: string) => ({ name: `${price}짜리`, price });

describe("cheapestMenu", () => {
  // 목록에 대표메뉴 가격을 그대로 띄우면 "1만원 이하"를 켜놓고 15,000원이 보인다.
  // 필터가 통과시킨 근거가 된 메뉴를 보여줘야 말이 맞는다.
  it("필터를 통과시킨 그 메뉴를 돌려준다", () => {
    const menus = [menu("15000"), menu("8000"), menu("12000")];
    expect(cheapestMenu(menus)?.name).toBe("8000짜리");
  });

  it("쓸 수 있는 가격이 없으면 null이다", () => {
    expect(cheapestMenu([menu("-1"), menu("")])).toBeNull();
    expect(cheapestMenu([])).toBeNull();
  });
});

describe("minMenuPrice", () => {
  it("표시된 메뉴 중 가장 싼 값을 고른다", () => {
    expect(minMenuPrice([menu("15000"), menu("8000"), menu("12000")])).toBe(8000);
  });

  it("메뉴가 없으면 null이다", () => {
    expect(minMenuPrice([])).toBeNull();
  });

  // 카카오 panel3은 가격 미공개를 -1로 준다. 이걸 숫자로 받으면 최저가가 -1이 되어
  // 모든 가게가 "1만원 이하"를 통과해버린다.
  it("-1(미공개)은 가격으로 치지 않는다", () => {
    expect(minMenuPrice([menu("-1"), menu("-1")])).toBeNull();
    expect(minMenuPrice([menu("-1"), menu("9000")])).toBe(9000);
  });

  it("빈 문자열과 숫자가 아닌 값도 가격으로 치지 않는다", () => {
    expect(minMenuPrice([menu(""), menu("가격문의")])).toBeNull();
    expect(minMenuPrice([menu(""), menu("7000")])).toBe(7000);
  });

  it("0원은 가격으로 치지 않는다", () => {
    expect(minMenuPrice([menu("0")])).toBeNull();
  });

  it("상한은 1만원이다", () => {
    expect(CHEAP_LIMIT).toBe(10000);
    expect(minMenuPrice([menu("10000")])).toBeLessThanOrEqual(CHEAP_LIMIT);
  });
});
