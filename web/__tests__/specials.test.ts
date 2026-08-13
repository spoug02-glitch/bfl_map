import { describe, expect, it } from "vitest";
import { SPECIAL_NAME_MAX, SPECIAL_NOTE_MAX, validateSpecialInput } from "@/lib/specials";

const base = { placeId: "123456", menuName: "초밥+냉모밀", price: 10000 };

describe("validateSpecialInput", () => {
  it("메뉴명과 가격만으로 통과한다 — 별점과 비고는 선택이다", () => {
    const v = validateSpecialInput(base);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.taste).toBeNull();
      expect(v.value.note).toBeNull();
    }
  });

  it("네 칸을 다 채워도 통과한다", () => {
    const v = validateSpecialInput({ ...base, taste: 4, note: "평일 11:30~13:30만" });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.taste).toBe(4);
      expect(v.value.note).toBe("평일 11:30~13:30만");
    }
  });

  it("메뉴명이 없거나 공백이면 막는다", () => {
    expect(validateSpecialInput({ ...base, menuName: "  " }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, menuName: undefined }).ok).toBe(false);
  });

  it("메뉴명 길이 상한", () => {
    expect(validateSpecialInput({ ...base, menuName: "가".repeat(SPECIAL_NAME_MAX + 1) }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, menuName: "가".repeat(SPECIAL_NAME_MAX) }).ok).toBe(true);
  });

  it("가격은 점심값 범위의 정수여야 한다", () => {
    expect(validateSpecialInput({ ...base, price: "10000" }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, price: 10000.5 }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, price: 100 }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, price: 200_000 }).ok).toBe(false);
  });

  it("별점은 1~5 정수만", () => {
    expect(validateSpecialInput({ ...base, taste: 0 }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, taste: 6 }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, taste: 3.5 }).ok).toBe(false);
  });

  it("비고는 상한까지, 빈 문자열은 null로", () => {
    expect(validateSpecialInput({ ...base, note: "가".repeat(SPECIAL_NOTE_MAX + 1) }).ok).toBe(false);
    const v = validateSpecialInput({ ...base, note: "  " });
    expect(v.ok && v.value.note === null).toBe(true);
  });

  it("이상한 placeId는 막는다", () => {
    expect(validateSpecialInput({ ...base, placeId: "__proto__" }).ok).toBe(false);
    expect(validateSpecialInput({ ...base, placeId: "1; DROP TABLE" }).ok).toBe(false);
  });
});
