/**
 * WGS84 두 점 사이의 하버사인 거리.
 *
 * collector/geo.py의 포팅이다. 두 구현이 갈라지면 목록이 말하는 거리와
 * restaurants.json에 박혀 있는 distance_km가 어긋난다 — __tests__/geo.test.ts가
 * 데이터셋 전체를 대조해 그걸 막는다. 공식이나 상수를 한쪽만 바꾸지 말 것.
 */
export const EARTH_RADIUS_KM = 6371.0088;

export type LatLng = { lat: number; lng: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  if (a.lat === b.lat && a.lng === b.lng) return 0;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lng - a.lng);
  const h =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
