import { describe, expect, it } from "vitest";
import {
  NICKNAME_MAX_LEN,
  NICKNAME_MIN_LEN,
  WITHDRAWN_NICKNAME,
  WITHDRAWN_USER_ID,
  suggestNickname,
  validateNickname,
} from "@/lib/nickname";

describe("validateNickname", () => {
  it("accepts a plain Korean nickname", () => {
    expect(validateNickname("점심러4821")).toEqual({ ok: true, value: "점심러4821" });
  });

  it("counts Korean length by code point, not by byte", () => {
    expect(validateNickname("가".repeat(NICKNAME_MAX_LEN)).ok).toBe(true);
    expect(validateNickname("가".repeat(NICKNAME_MAX_LEN + 1)).ok).toBe(false);
  });

  it("rejects a nickname shorter than the minimum", () => {
    expect(validateNickname("가".repeat(NICKNAME_MIN_LEN - 1)).ok).toBe(false);
    expect(validateNickname("가".repeat(NICKNAME_MIN_LEN)).ok).toBe(true);
  });

  it("allows latin letters, digits and underscore", () => {
    expect(validateNickname("lunch_42").ok).toBe(true);
  });

  it("rejects whitespace, punctuation and emoji", () => {
    expect(validateNickname("점심 러").ok).toBe(false);
    expect(validateNickname("점심러!").ok).toBe(false);
    expect(validateNickname("점심러🍜").ok).toBe(false);
  });

  it("rejects bare jamo", () => {
    expect(validateNickname("ㄱㄴ").ok).toBe(false);
    expect(validateNickname("ㅏㅑ").ok).toBe(false);
  });

  it("rejects profanity", () => {
    expect(validateNickname("씨발러").ok).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(validateNickname(undefined).ok).toBe(false);
    expect(validateNickname(42).ok).toBe(false);
    expect(validateNickname(null).ok).toBe(false);
  });

  it("returns a Korean error message on every rejection", () => {
    const r = validateNickname("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/[가-힣]/);
  });
});

// 탈퇴자의 글에 남는 이름이라, 누가 이걸 선점하면 탈퇴자 행세를 할 수 있다.
describe("탈퇴자 이름은 예약어다", () => {
  it("문자셋이 공백을 막아 원본 그대로는 애초에 못 만든다", () => {
    expect(validateNickname(WITHDRAWN_NICKNAME).ok).toBe(false);
  });

  it("공백만 뺀 형태도 막는다 — 눈으로는 같은 이름이다", () => {
    expect(validateNickname("익명의저녁러").ok).toBe(false);
  });

  it("대표 계정 id는 실제 계정과 겹칠 수 없는 모양이다", () => {
    // 실제 계정은 언제나 'kakao:123' 꼴이라 콜론이 없으면 충돌하지 않는다
    expect(WITHDRAWN_USER_ID).not.toContain(":");
  });

  it("비슷하지만 다른 이름은 그대로 쓸 수 있다", () => {
    expect(validateNickname("익명의점심러").ok).toBe(true);
    expect(validateNickname("저녁러").ok).toBe(true);
  });
});

describe("suggestNickname", () => {
  it("always produces a value the validator accepts", () => {
    for (let i = 0; i < 200; i++) {
      expect(validateNickname(suggestNickname()).ok).toBe(true);
    }
  });

  it("uses the 점심러 + 6 digit shape", () => {
    // 6 digits, not 4: nicknames are unique now, so a narrow space would make
    // the prefilled suggestion collide and bounce off the server's 409.
    expect(suggestNickname()).toMatch(/^점심러\d{6}$/);
  });
});
