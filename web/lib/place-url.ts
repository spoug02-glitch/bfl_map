/** sharePath()가 만드는 경로의 접두사. 여기서 자른 나머지가 가게 id다. */
const PLACE_PREFIX = "/place/";

/**
 * 주소가 가리키는 가게 id. 목록 앵커를 눌러 pushState로 얕게 바꾼 주소를
 * 뒤로가기(popstate)로 다시 읽을 때 쓴다 — href를 만드는 쪽(sharePath)과
 * 읽는 쪽이 한 파일 안에서 짝을 이뤄야 어긋나지 않는다.
 *
 * 두 형태를 받는다. /place/<id>가 지금의 공유 경로이고, /?place=<id>는 예전에
 * 뿌려서 이미 남의 채팅방에 박혀 있는 링크다.
 *
 * id 형식(PLACE_ID_RE)은 여기서 검사하지 않는다. 형식이 틀린 값을 null로
 * 뭉개면 화면이 아무 말 없이 지도만 띄우는데, 지금은 restaurants.json에서
 * 못 찾은 id를 "공유된 가게를 찾지 못했어요"로 알려주고 있다. 그 안내를
 * 살리려면 값을 그대로 넘겨야 한다. 조회는 배열 find라 상속 키에 걸릴
 * 여지도 없다.
 */
export function placeIdFromUrl(pathname: string, search: string): string | null {
  if (pathname.startsWith(PLACE_PREFIX)) {
    const raw = pathname.slice(PLACE_PREFIX.length);
    if (raw) return decodePlaceId(raw);
  }
  return new URLSearchParams(search).get("place") || null;
}

/**
 * 주소창은 누구나 손으로 고칠 수 있고 `%E0%A4%A`처럼 깨진 이스케이프는
 * decodeURIComponent가 URIError를 던진다. popstate 핸들러 안에서 터지면
 * 뒤로가기가 통째로 먹통이 되므로 못 읽은 값은 없는 것으로 본다.
 */
function decodePlaceId(raw: string): string | null {
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return null;
  }
}
