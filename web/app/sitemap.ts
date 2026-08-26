import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import shareIndex from "@/lib/share-index.json";

// changefreq와 priority는 넣지 않는다 — 구글이 둘 다 무시한다.
// lastModified 도 뺐다. 빌드 시각을 넣으면 내용이 안 바뀐 페이지까지 매번
// "방금 수정됨"으로 주장하게 되어, 쓸 수 있는 신호를 거짓으로 만든다.
//
// 주소의 기준은 SITE_URL 하나다. 프리뷰 배포가 자기 주소로 사이트맵을 뱉으면
// 쓸모가 없다.
//
// /admin·/login·/signup·/ladder는 색인 대상이 아니다 → robots.ts 에서 막는다.
const STATIC_PATHS = ["/", "/about", "/contact", "/report", "/owner", "/privacy", "/terms"];

/**
 * 가게 페이지를 여기 넣는 것은 2026-08-25의 판단을 뒤집은 것이다.
 *
 * 그때는 "같은 지도 셸에 OG 태그만 다른 구조라 중복 콘텐츠로 읽힐 소지가 있고,
 * 메인 화면에서 링크로 이미 도달 가능하다"를 이유로 뺐다. 뒤의 전제가 사실이
 * 아니었다 — 2026-08-26에 라이브 DOM을 열어보니 목록 50개가 전부 `<button onClick>`이고
 * href에 /place/ 가 든 앵커는 0개였다. 유일한 링크인 RouletteResult는 /ladder/[token]
 * 에서만 그려지는데 그 경로는 robots.txt가 막고 있다. 사이트맵에서도 빠져 있었으니
 * 5,826곳 전부가 크롤러에게는 존재하지 않는 페이지였다.
 *
 * 그 뒤 PlaceList가 진짜 앵커를 갖게 됐지만(claude/place-route-anchors) 이 목록은
 * 여전히 필요하다. 앵커는 두 겹으로 부분적이다 — 목록은 반경 안에서 최대 50줄만
 * 그리므로 기본 200m 화면에 뜨는 건 5,826곳 중 수십 곳이고, 그 목록 자체가
 * restaurants.json을 받은 뒤 클라이언트에서 그려져 서버가 보낸 HTML에는 없다.
 * 자바스크립트를 실행하는 크롤러만 그 앵커를 본다.
 *
 * 앞의 우려는 그대로 남아 있다. 그래서 이 목록은 **가게별 canonical과 가게별
 * JSON-LD가 함께 나갈 때만 성립한다** — 셋은 세트다. Search Console에 "중복" 판정이
 * 쌓이면 되돌릴 곳은 아래 한 줄이고, 그때는 본문을 구별되게 만드는 쪽(지도 셸의
 * 서버 렌더)이 진짜 답이다.
 *
 * 5,826개는 사이트맵 한 파일 상한(50,000 URL / 50MB) 안이라 쪼개지 않는다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    ...STATIC_PATHS,
    ...Object.keys(shareIndex).map((id) => `/place/${id}`),
  ];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
