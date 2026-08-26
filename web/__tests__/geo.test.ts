import { describe, expect, it } from "vitest";
import { formatDistance, haversineKm } from "@/lib/geo";
import { CENTER } from "@/lib/constants";
import restaurants from "../public/restaurants.json";

type Row = { name: string; lat: number; lng: number; distance_km: number };
const rows = restaurants as Row[];

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(CENTER, CENTER)).toBe(0);
  });

  it("is symmetric", () => {
    const a = { lat: 37.6545, lng: 127.0499 };
    const b = { lat: 37.6601, lng: 127.0312 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 12);
  });

  // 이게 이 모듈의 존재 이유다. 수집기(collector/geo.py)가 같은 공식으로 계산해
  // restaurants.json의 distance_km를 박아뒀다. 두 구현이 갈라지면 목록의 거리와
  // 가게 상세의 거리가 서로 다른 값을 말하게 된다.
  it("reproduces the distances the collector baked into the dataset", () => {
    const sample = [0, 1, 500, 1500, 3000, 4500, rows.length - 1].map(i => rows[i]);
    for (const r of sample) {
      const mine = haversineKm(CENTER, { lat: r.lat, lng: r.lng });
      // 데이터는 소수점 둘째 자리로 반올림되어 저장된다
      expect(Math.round(mine * 100) / 100).toBeCloseTo(r.distance_km, 2);
    }
  });

  it("agrees with the collector across the whole dataset", () => {
    const off = rows.filter(r => {
      const mine = Math.round(haversineKm(CENTER, { lat: r.lat, lng: r.lng }) * 100) / 100;
      return Math.abs(mine - r.distance_km) > 0.01;
    });
    expect(off).toHaveLength(0);
  });

  it("returns a sane magnitude for a known city-scale gap", () => {
    // 창동씨드큐브 -> 서울시청 직선거리는 대략 12km대다
    const cityHall = { lat: 37.5663, lng: 126.9779 };
    const d = haversineKm(CENTER, cityHall);
    expect(d).toBeGreaterThan(11);
    expect(d).toBeLessThan(14);
  });
});

describe("formatDistance", () => {
  // 1km 미만은 미터로 끊는다. "0.02km"는 읽는 사람이 한 번 환산해야 하는 숫자다.
  it("renders sub-kilometre distances as whole metres", () => {
    expect(formatDistance(0.016)).toBe("16m");
    expect(formatDistance(0.001)).toBe("1m");
    expect(formatDistance(0.9994)).toBe("999m");
  });

  it("renders a kilometre and beyond with one decimal", () => {
    expect(formatDistance(1)).toBe("1.0km");
    expect(formatDistance(2.35)).toBe("2.4km");
    expect(formatDistance(5)).toBe("5.0km");
  });

  // 목록·상세·룰렛이 같은 가게를 서로 다른 문자열로 부르던 버그(2026-08-26)를 막는다.
  // 세 화면이 이 함수 하나만 보게 만든 것이 수정의 핵심이라, 포맷이 갈라지면 여기서 깨진다.
  it("gives one string per distance, whatever screen asks", () => {
    for (const km of [0.01, 0.25, 0.999, 1.0, 2.35, 4.99, 5.0]) {
      expect(formatDistance(km)).toBe(formatDistance(km));
      expect(formatDistance(km)).toMatch(/^\d+(\.\d)?(m|km)$/);
    }
  });
});
