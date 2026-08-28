import { LEGACY_PLACE_ID_RE, PLACE_ID_RE } from "@/lib/constants";
import type { ShareSubject } from "@/lib/share-copy";
import legacyPlaceIds from "@/lib/legacy-place-ids.json";
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
const legacyIds = legacyPlaceIds as Record<string, string>;

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

/**
 * 2026-08-27 전에 뿌려진 `/place/<카카오숫자id>` 링크를 새 관리번호로 옮긴다.
 *
 * 그 주소들은 남의 채팅방에 박혀 있고 검색 색인과 무관하게 계속 열린다 —
 * `place-url.ts` 가 *"이 경로가 끊기면 남의 채팅방에 있는 링크가 죽는다"* 고
 * 이미 경고하던 그 문제다. 신원이 관리번호로 바뀌면서 실제로 끊겼고, 이 함수가
 * 그걸 잇는다.
 *
 * 옛 id 를 아는 가게는 11,565곳 중 4,857곳뿐이다. 나머지는 애초에 그 시절
 * 지도에 없던 가게라 옛 링크가 존재할 수 없다.
 *
 * **`PLACE_ID_RE` 는 느슨하게 만들지 않았다.** API 본문·사다리 토큰은 새 형식만
 * 받아야 한다. 옛 id 는 오직 이 경로에서만, 그것도 새 id 로 바꿔서 넘긴다.
 */
export function resolveLegacyPlaceId(id: string): string | undefined {
  if (!LEGACY_PLACE_ID_RE.test(id)) return undefined;
  return Object.hasOwn(legacyIds, id) ? legacyIds[id] : undefined;
}
