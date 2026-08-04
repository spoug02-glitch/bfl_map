/**
 * 공유 카드 문구. 카카오톡 공유와 링크 미리보기(OG 태그)가 같은 문구를 쓰도록
 * 한 곳에 둔다 — 두 군데서 따로 만들면 조용히 갈라진다.
 *
 * 전체 Restaurant이 아니라 최소 형태를 받는다. OG 태그는 5,834건짜리
 * restaurants.json 대신 얇은 색인(share-index.json)만 읽기 때문이다.
 */
export type ShareSubject = {
  name: string;
  category: string;
  distance_km: number;
  menus: { name: string; price: string }[];
};

/** 카카오 Feed 템플릿의 title 상한이 40자다. */
const TITLE_MAX = 40;
/** 같은 템플릿의 description 상한이 76자다. */
const DESC_MAX = 76;

export function shareTitle(r: ShareSubject): string {
  return `${r.name} · ${r.category}`.slice(0, TITLE_MAX);
}

export function shareDescription(r: ShareSubject): string {
  const top = r.menus[0];
  const menuPart = top?.price ? ` · ${top.name} ${Number(top.price).toLocaleString("ko-KR")}원` : "";
  return `씨드큐브에서 ${r.distance_km}km${menuPart}`.slice(0, DESC_MAX);
}

/** 공유 링크. 가게별 OG 태그가 붙는 경로여야 슬랙·디스코드에서 카드가 뜬다. */
export function sharePath(placeId: string): string {
  return `/place/${encodeURIComponent(placeId)}`;
}
