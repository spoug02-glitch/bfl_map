import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/geo";
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
