import { describe, expect, it } from "vitest";
import {
  BODY_MAX,
  OWNER_MENU_MAX,
  REPORT_KINDS,
  looksLikeBot,
  validateOwnerMenuInput,
  validateReportInput,
} from "@/lib/reports";

const report = (o: Record<string, unknown> = {}) => ({
  kind: "place_fix", body: "여기 폐업했어요", ...o,
});
const owner = (o: Record<string, unknown> = {}) => ({
  placeId: "12345", contact: "010-0000-0000",
  menus: [{ menuName: "김치찌개", price: 9000 }], ...o,
});

describe("validateReportInput", () => {
  it("최소 입력을 받는다", () => {
    const r = validateReportInput(report());
    expect(r.ok && r.value).toMatchObject({ kind: "place_fix", placeId: null, contact: null });
  });

  it("네 종류만 받는다", () => {
    for (const k of REPORT_KINDS) expect(validateReportInput(report({ kind: k })).ok).toBe(true);
    expect(validateReportInput(report({ kind: "spam" })).ok).toBe(false);
  });

  it("본문이 비면 거절한다", () => {
    expect(validateReportInput(report({ body: "   " })).ok).toBe(false);
  });

  it("본문 상한을 넘으면 거절한다", () => {
    expect(validateReportInput(report({ body: "가".repeat(BODY_MAX + 1) })).ok).toBe(false);
  });

  // 답이 필요 없는 제보가 많다. 강제하면 그것 때문에 안 보낸다.
  it("연락처는 없어도 된다", () => {
    expect(validateReportInput(report({ contact: "" })).ok).toBe(true);
  });

  // 가게와 무관한 제보가 있고, 가게 이름을 본문에 적는 사람도 있다.
  it("가게는 없어도 되지만 형식이 틀리면 거절한다", () => {
    expect(validateReportInput(report({ placeId: "" })).ok).toBe(true);
    expect(validateReportInput(report({ placeId: "abc" })).ok).toBe(false);
    const r = validateReportInput(report({ placeId: "987" }));
    expect(r.ok && r.value.placeId).toBe("987");
  });

  it("앞뒤 공백을 다듬는다", () => {
    const r = validateReportInput(report({ body: "  폐업  ", contact: "  a@b.c  " }));
    expect(r.ok && r.value).toMatchObject({ body: "폐업", contact: "a@b.c" });
  });
});

describe("validateOwnerMenuInput", () => {
  it("정상 입력을 받는다", () => {
    const r = validateOwnerMenuInput(owner());
    expect(r.ok && r.value.menus).toEqual([{ menuName: "김치찌개", price: 9000 }]);
  });

  // 제보와 달리 필수다 — 승인 전에 확인할 일이 생긴다.
  it("연락처가 없으면 거절한다", () => {
    expect(validateOwnerMenuInput(owner({ contact: "  " })).ok).toBe(false);
  });

  it("가게를 안 고르면 거절한다", () => {
    expect(validateOwnerMenuInput(owner({ placeId: "abc" })).ok).toBe(false);
  });

  it("메뉴가 없으면 거절한다", () => {
    expect(validateOwnerMenuInput(owner({ menus: [] })).ok).toBe(false);
  });

  it("한 번에 올릴 수 있는 개수를 넘으면 거절한다", () => {
    const many = Array.from({ length: OWNER_MENU_MAX + 1 }, (_, i) => ({ menuName: `메뉴${i}`, price: 9000 }));
    expect(validateOwnerMenuInput(owner({ menus: many })).ok).toBe(false);
  });

  it("가격이 점심값 범위를 벗어나면 거절한다", () => {
    expect(validateOwnerMenuInput(owner({ menus: [{ menuName: "김밥", price: 100 }] })).ok).toBe(false);
    expect(validateOwnerMenuInput(owner({ menus: [{ menuName: "한우", price: 200000 }] })).ok).toBe(false);
  });

  it("어느 메뉴가 틀렸는지 이름으로 알려준다", () => {
    const r = validateOwnerMenuInput(owner({ menus: [{ menuName: "돈까스", price: 0 }] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("돈까스");
  });

  it("가격이 숫자가 아니면 거절한다", () => {
    expect(validateOwnerMenuInput(owner({ menus: [{ menuName: "김밥", price: "9000" }] })).ok).toBe(false);
  });
});

// 사람에게는 숨겨진 칸이라 비어 있는 게 정상이다. CAPTCHA 대신 쓰는 이유는
// 사람에게 통행료를 물리지 않기 때문이다.
describe("looksLikeBot", () => {
  it("허니팟이 비어 있으면 사람으로 본다", () => {
    expect(looksLikeBot(report())).toBe(false);
    expect(looksLikeBot(report({ website: "" }))).toBe(false);
  });
  it("허니팟이 채워져 있으면 봇으로 본다", () => {
    expect(looksLikeBot(report({ website: "http://spam" }))).toBe(true);
  });
});
