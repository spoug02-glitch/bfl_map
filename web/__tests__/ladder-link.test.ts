import { describe, expect, it } from "vitest";
import { MAX_LEGS, MIN_LEGS, decodeLadder, encodeLadder, type LadderDraw } from "@/lib/ladder-link";
import { resolveLegacyPlaceId } from "@/lib/place-index";

const draw: LadderDraw = { placeIds: ["3090000-101-2024-00209", "3090000-101-2019-00131", "3100000-101-2021-00172"], winner: 1, seed: 42 };

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

/**
 * 2026-08-27 전에 만들어진 룰렛 공유 토큰에는 카카오 place_id 가 박혀 있다.
 * 신원이 관리번호로 바뀌면서 그 토큰들이 통째로 "읽을 수 없는 링크"가 됐다 —
 * RouletteResult 가 *"사다리 시절 링크가 이미 나가 있어서"* 라고 적어둔 그 링크들이다.
 */
describe("옛 카카오 id 토큰", () => {
  // 실제 legacy-place-ids.json 에 있는 값으로 만든 토큰이다. 지어낸 id 로 만들면
  // 표가 비어도 테스트가 통과해버린다.
  const LEGACY_TOKEN =
    "eyJwIjpbIjgzMzQwNiIsIjEzMTk5OTQiLCI0MDEzNTk5IiwiNDI2ODc1NCJdLCJ3IjoxLCJzIjowLjV9";

  it("해석기를 주면 관리번호로 바꿔 읽는다", () => {
    const draw = decodeLadder(LEGACY_TOKEN, resolveLegacyPlaceId);
    expect(draw).not.toBeNull();
    expect(draw!.placeIds).toEqual([
      "3080000-101-2021-00117",
      "3090000-101-2016-00039",
      "3090000-101-2020-00158",
      "3100000-101-2022-00019",
    ]);
    expect(draw!.winner).toBe(1);
  });

  it("해석기를 안 주면 예전처럼 거절한다 — 기본값은 엄격하다", () => {
    expect(decodeLadder(LEGACY_TOKEN)).toBeNull();
  });

  it("하나라도 해석 못 하면 통째로 버린다", () => {
    // 반만 맞는 후보 목록을 보여주는 쪽이 못 읽는 링크보다 나쁘다.
    const mixed = Buffer.from(
      JSON.stringify({ p: ["833406", "1319994", "4013599", "99999999999"], w: 0, s: 0.5 }),
    ).toString("base64url");
    expect(decodeLadder(mixed, resolveLegacyPlaceId)).toBeNull();
  });

  it("해석 뒤에도 중복은 거절한다", () => {
    // 서로 다른 옛 id 둘이 같은 관리번호로 풀릴 수 있다.
    const resolveAllSame = () => "3090000-101-2024-00209";
    const token = Buffer.from(
      JSON.stringify({ p: ["111", "222", "333"], w: 0, s: 0.5 }),
    ).toString("base64url");
    expect(decodeLadder(token, resolveAllSame)).toBeNull();
  });
});
