import { describe, expect, it } from "vitest";
import { buildLadder, followLeg, LADDER_ROWS } from "@/lib/ladder";

describe("buildLadder", () => {
  it("is reproducible from the seed", () => {
    expect(buildLadder(5, 1234)).toEqual(buildLadder(5, 1234));
  });

  it("draws a different ladder for a different seed", () => {
    expect(buildLadder(5, 1)).not.toEqual(buildLadder(5, 2));
  });

  it("has one row per rung level", () => {
    expect(buildLadder(4, 7)).toHaveLength(LADDER_ROWS);
  });

  it("never puts two rungs side by side on the same row", () => {
    // 붙어 있으면 어느 쪽으로 건너야 할지가 모호해진다
    for (let seed = 0; seed < 200; seed++) {
      for (const row of buildLadder(6, seed)) {
        for (let i = 0; i < row.length - 1; i++) {
          expect(row[i] && row[i + 1]).toBe(false);
        }
      }
    }
  });

  it("has a rung slot between each pair of legs", () => {
    expect(buildLadder(4, 9)[0]).toHaveLength(3);
  });
});

describe("followLeg", () => {
  it("lands every start on a different finish", () => {
    // 사다리의 성질: 출발이 다르면 도착도 다르다
    for (let seed = 0; seed < 100; seed++) {
      const legs = 6;
      const ladder = buildLadder(legs, seed);
      const ends = Array.from({ length: legs }, (_, i) => followLeg(ladder, i));
      expect(new Set(ends).size).toBe(legs);
      expect([...ends].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    }
  });

  it("stays inside the ladder", () => {
    const ladder = buildLadder(3, 5);
    for (let i = 0; i < 3; i++) {
      const end = followLeg(ladder, i);
      expect(end).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThan(3);
    }
  });

  it("returns the same finish every time it is walked", () => {
    const ladder = buildLadder(5, 77);
    expect(followLeg(ladder, 2)).toBe(followLeg(ladder, 2));
  });

  // -1을 그대로 돌려주면 호출부가 그걸 배열 인덱스로 써서 undefined를 만진다.
  it.each([-1, 5, 99, 1.5, NaN])("refuses the out-of-range start %p", (bad) => {
    expect(followLeg(buildLadder(5, 3), bad)).toBe(-1);
  });
});
