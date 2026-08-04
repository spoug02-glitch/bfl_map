import { describe, expect, it } from "vitest";
import {
  NICKNAME_MAX_LEN,
  NICKNAME_MIN_LEN,
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
