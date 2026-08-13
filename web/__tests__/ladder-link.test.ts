import { describe, expect, it } from "vitest";
import { MAX_LEGS, MIN_LEGS, decodeLadder, encodeLadder, type LadderDraw } from "@/lib/ladder-link";

const draw: LadderDraw = { placeIds: ["1080924210", "13107949", "17266418"], winner: 1, seed: 42 };

describe("encodeLadder / decodeLadder", () => {
  it("round-trips a draw", () => {
    expect(decodeLadder(encodeLadder(draw))).toEqual(draw);
  });

  it("produces a URL-safe token", () => {
    // base64의 +, /, = 가 그대로 나가면 경로에서 깨진다
    expect(encodeLadder(draw)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("stays short enough to share", () => {
    const full: LadderDraw = {
      placeIds: Array.from({ length: MAX_LEGS }, (_, i) => String(1000000000 + i)),
      winner: MAX_LEGS - 1,
      seed: 999999,
    };
    // 카톡·슬랙이 줄바꿈 없이 보여주는 길이를 넘지 않아야 한다
    expect(encodeLadder(full).length).toBeLessThan(300);
  });

  it.each([
    ["빈 문자열", ""],
    ["base64가 아닌 값", "!!!!"],
    ["JSON이 아닌 값", Buffer.from("nope").toString("base64url")],
    ["다른 모양의 JSON", Buffer.from(JSON.stringify({ a: 1 })).toString("base64url")],
  ])("returns null for %s", (_label, token) => {
    expect(decodeLadder(token)).toBeNull();
  });

  it("rejects a winner pointing outside the candidates", () => {
    const bad = Buffer.from(JSON.stringify({ p: ["1", "2"], w: 5, s: 1 })).toString("base64url");
    expect(decodeLadder(bad)).toBeNull();
  });

  it("rejects a negative winner", () => {
    const bad = Buffer.from(JSON.stringify({ p: ["1", "2"], w: -1, s: 1 })).toString("base64url");
    expect(decodeLadder(bad)).toBeNull();
  });

  it.each([MIN_LEGS - 1, MAX_LEGS + 1])("rejects %i candidates", (n) => {
    const bad = Buffer.from(
      JSON.stringify({ p: Array.from({ length: n }, (_, i) => String(i + 1)), w: 0, s: 1 }),
    ).toString("base64url");
    expect(decodeLadder(bad)).toBeNull();
  });

  it("rejects a place id that is not a place id", () => {
    // 링크는 남이 만들어 보낼 수 있다 — 그대로 믿고 조회에 넘기지 않는다
    const bad = Buffer.from(JSON.stringify({ p: ["__proto__", "2"], w: 0, s: 1 })).toString("base64url");
    expect(decodeLadder(bad)).toBeNull();
  });

  it("rejects duplicate candidates", () => {
    const bad = Buffer.from(JSON.stringify({ p: ["7", "7", "9"], w: 0, s: 1 })).toString("base64url");
    expect(decodeLadder(bad)).toBeNull();
  });
});
