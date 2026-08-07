import { describe, expect, it } from "vitest";
import { MAX_LEGS, MIN_LEGS } from "@/lib/ladder-link";
import { SLICE_COLORS, sliceCenterDeg, sliceColor, sliceLabel, slicePath, spinTo } from "@/lib/roulette";

const norm = (deg: number) => ((deg % 360) + 360) % 360;

describe("조각 배치", () => {
  it("후보 수만큼 원을 고르게 나눈다", () => {
    expect(sliceCenterDeg(4, 0)).toBe(45);
    expect(sliceCenterDeg(4, 3)).toBe(315);
    expect(sliceCenterDeg(2, 0)).toBe(90);
  });

  it("최대 후보 수까지 색과 글자가 서로 다르다", () => {
    const colors = new Set<string>();
    const labels = new Set<string>();
    for (let i = 0; i < MAX_LEGS; i++) {
      colors.add(sliceColor(i));
      labels.add(sliceLabel(i));
    }
    expect(colors.size).toBe(MAX_LEGS);
    expect(labels.size).toBe(MAX_LEGS);
    expect(SLICE_COLORS.length).toBeGreaterThanOrEqual(MAX_LEGS);
  });

  it("부채꼴 path는 중심에서 시작해 닫힌다", () => {
    const d = slicePath(100, 100, 90, 0, 90);
    expect(d.startsWith("M 100 100")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    // 90도는 반원보다 작으므로 large-arc 플래그가 0이어야 한다
    expect(d).toContain("A 90 90 0 0 1");
  });

  it("반원보다 큰 조각은 large-arc 플래그를 세운다", () => {
    expect(slicePath(100, 100, 90, 0, 240)).toContain("A 90 90 0 1 1");
  });
});

describe("spinTo", () => {
  it("멈춘 자리에서 당첨 조각이 12시에 온다", () => {
    for (let n = MIN_LEGS; n <= MAX_LEGS; n++) {
      for (let w = 0; w < n; w++) {
        const end = spinTo(n, w, 0);
        expect(norm(end)).toBeCloseTo(norm(-sliceCenterDeg(n, w)), 6);
      }
    }
  });

  it("항상 앞으로 돈다 — 다시 돌려도 뒤로 감기지 않는다", () => {
    let at = 0;
    for (const w of [3, 0, 2, 1, 3]) {
      const next = spinTo(4, w, at);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
  });

  it("최소 회전 바퀴 수를 지킨다", () => {
    expect(spinTo(4, 0, 0, 4)).toBeGreaterThanOrEqual(4 * 360);
    expect(spinTo(8, 7, 1000, 4)).toBeGreaterThanOrEqual(1000 + 4 * 360);
  });
});
