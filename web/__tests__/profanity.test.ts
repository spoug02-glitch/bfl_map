import { describe, expect, it } from "vitest";
import { containsProfanity } from "@/lib/profanity";

describe("containsProfanity", () => {
  describe("allows ordinary food-review language", () => {
    it.each([
      "이 집 김치찌개 존맛탱이에요",
      "미친 존맛이에요 강추",
      "점심 웨이팅이 좀 긴 편이에요",
      "고기 씹는 맛이 좋아요",
      "개존맛",
      "미친맛집 인정",
      "마약김밥 파는 곳이에요",
      "시발점 근처 맛집",
      "시발역 앞 국밥집",
      "쌍화차 맛있어요",
      "새끼돼지 수육이 맛있어요",
      "",
    ])("%s", (text) => {
      expect(containsProfanity(text)).toBe(false);
    });
  });

  describe("blocks profanity", () => {
    it.each([
      "씨발 맛없어",
      "존나 맛없다",
      "ㅅㅂ 맛없어요",
      "시발 진짜 웨이팅 길다",
      "개씨발 맛없다",
      "졸라 맛없음",
      "ㅄ 맛없어요",
      "ㅈㄹ 맛없다",
    ])("%s", (text) => {
      expect(containsProfanity(text)).toBe(true);
    });
  });
});
