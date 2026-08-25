import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// 정적 안내 페이지만 담는다. /place/[id]는 5,834곳 전체를 넣으면 사이트맵이
// 지나치게 커지고, 같은 지도 셸에 OG 태그만 다른 구조라 중복 콘텐츠로 읽힐
// 소지가 있다. 검색엔진 우선순위상 메인 화면에서 링크로 이미 도달 가능하다.
// /admin·/login·/signup은 색인 대상이 아니다 → robots.ts 에서 막는다.
//
// changefreq와 priority는 넣지 않는다 — 구글이 둘 다 무시한다.
// lastModified 도 뺐다. 빌드 시각을 넣으면 내용이 안 바뀐 페이지까지 매번
// "방금 수정됨"으로 주장하게 되어, 쓸 수 있는 신호를 거짓으로 만든다.
//
// 주소의 기준은 SITE_URL 하나다. 프리뷰 배포가 자기 주소로 사이트맵을 뱉으면
// 쓸모가 없다.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/about", "/contact", "/report", "/owner", "/privacy", "/terms"];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
