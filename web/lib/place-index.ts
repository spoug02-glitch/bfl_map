import { PLACE_ID_RE } from "@/lib/constants";
import type { ShareSubject } from "@/lib/share-copy";
import shareIndex from "@/lib/share-index.json";

/**
 * share-index.json 한 줄 (scripts/build-share-index.mjs가 만든다).
 *
 * 공유 카드 문구가 쓰는 최소 형태(ShareSubject)에, 구조화 데이터가 요구하는 만큼만
 * 더했다 — 주소·좌표·전화. 5,826건이 서버 번들에 실리므로 여기 필드를 하나 늘릴
 * 때마다 파일이 수백 KB씩 자란다. 화면에서만 쓰는 값은 restaurants.json이 담당한다.
 */
export type PlaceIndexEntry = ShareSubject & {
  address: string;
  lat: number;
  lng: number;
  phone: string;
};

const index = shareIndex as Record<string, PlaceIndexEntry>;

/**
 * 경로 파라미터는 누구나 아무 값이나 넣을 수 있다. 평범한 객체 조회는 `__proto__`나
 * `constructor` 같은 상속 키에 걸려 "없는 가게"인데도 객체/함수를 돌려주고, 그러면
 * 호출부의 fallback을 그냥 지나쳐 터진다. 형식 검사와 자기 키 검사를 둘 다 통과한
 * 것만 조회한다.
 */
export function lookupPlace(id: string): PlaceIndexEntry | undefined {
  if (!PLACE_ID_RE.test(id)) return undefined;
  return Object.hasOwn(index, id) ? index[id] : undefined;
}
