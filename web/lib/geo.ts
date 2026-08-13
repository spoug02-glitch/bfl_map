/**
 * WGS84 두 점 사이의 하버사인 거리. collector/geo.py의 포팅이다.
 *
 * 앱은 이 함수를 호출하지 않는다 — 화면에 쓰는 거리는 수집기가 회사 기준으로
 * 미리 계산해 restaurants.json에 넣어둔 distance_km다. 이 모듈이 있는 이유는
 * __tests__/geo.test.ts가 이걸 기준 구현으로 삼아 그 5,834개 값이 실제로 맞는지
 * 대조하기 때문이다. 데이터가 조용히 틀어지는 걸 잡아내는 장치다.
 *
 * 수집기의 공식이나 상수를 바꾸면 여기도 같이 바꿔야 한다.
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
