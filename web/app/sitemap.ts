import type { MetadataRoute } from "next";

// 정적 안내 페이지만 담는다. /place/[id]는 5,834곳 전체를 넣으면 사이트맵이
// 지나치게 커지고, 검색엔진 우선순위상 로그인 게이트 없는 메인 화면에서
// 링크로 이미 도달 가능하다. /admin은 운영자 전용이라 제외.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lunchpick.kr";
  const now = new Date();

  const staticPaths = [
    { path: "/", priority: 1 },
    { path: "/about", priority: 0.8 },
    { path: "/contact", priority: 0.5 },
    { path: "/terms", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
  ];

  return staticPaths.map(({ path, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    priority,
  }));
}
