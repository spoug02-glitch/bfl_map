/**
 * WGS84 두 점 사이의 하버사인 거리. collector/geo.py의 포팅이다.
 *
 * 기준점이 회사일 때 화면에 쓰는 거리는 수집기가 미리 계산해 restaurants.json에
 * 넣어둔 distance_km고, 그 값이 실제로 맞는지는 __tests__/geo.test.ts가 이 함수를
 * 기준 구현으로 삼아 5,800여 개를 전수 대조한다. 데이터가 조용히 틀어지는 걸
 * 잡아내는 장치다.
 *
 * 지도를 눌러 기준점을 옮기면 distance_km은 더 이상 답이 아니라, 그때부터는
 * MapApp의 distKm이 이 함수를 직접 호출한다. distance_km을 화면에 그대로 그리는
 * 코드는 기준점을 옮긴 순간 틀린 값을 말하게 된다 — 2026-08-26에 목록은 16m,
 * 상세는 2.35km를 말한 버그가 그것이다.
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

/**
 * 거리를 화면 문자열로. 1km 미만은 미터로 끊는다 — 걸어갈지 정하는 자리에서
 * "0.02km"는 읽는 사람이 한 번 환산해야 하는 숫자다.
 *
 * 목록·상세·룰렛이 같은 함수를 보게 하려고 여기 둔다. 예전엔 세 곳이 제각각이라
 * 같은 가게를 목록은 "16m", 상세는 "0.02km"로 불렀다. 포맷을 새로 만들지 말고
 * 이걸 부를 것.
 */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}
