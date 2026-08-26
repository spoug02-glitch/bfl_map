import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/constants";
import shareIndex from "@/lib/share-index.json";

const entries = sitemap();
const urls = entries.map((e) => e.url);
const placeIds = Object.keys(shareIndex);

const STATIC_PATHS = ["/", "/about", "/contact", "/report", "/owner", "/privacy", "/terms"];

describe("sitemap", () => {
  it.each(STATIC_PATHS)("안내 페이지 %s 를 담는다", (path) => {
    expect(urls).toContain(`${SITE_URL}${path}`);
  });

  // 2026-08-26까지 가게 페이지는 사이트맵에도 없고 어디에서도 링크되지 않았다.
  // 목록은 <button>이고 룰렛 결과의 링크는 robots.txt가 막은 /ladder/ 안에만 있어,
  // 5,826곳 전부가 크롤러에게 존재하지 않는 페이지였다.
  it("가게 페이지를 하나도 빠뜨리지 않는다", () => {
    const inSitemap = new Set(urls);
    const missing = placeIds.filter((id) => !inSitemap.has(`${SITE_URL}/place/${id}`));
    expect(missing).toEqual([]);
  });

  it("안내 페이지와 가게 페이지 말고는 없다", () => {
    expect(urls).toHaveLength(STATIC_PATHS.length + placeIds.length);
  });

  it("중복된 주소가 없다", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("전부 정식 도메인의 절대주소다", () => {
    expect(urls.every((u) => u.startsWith(`${SITE_URL}/`))).toBe(true);
  });

  // 구글은 changefreq·priority를 무시하고, 빌드 시각을 lastModified로 넣으면
  // 내용이 안 바뀐 페이지까지 매번 "방금 수정됨"이라고 주장하게 된다.
  it("changefreq·priority·lastModified를 넣지 않는다", () => {
    for (const e of entries) {
      expect(e.changeFrequency).toBeUndefined();
      expect(e.priority).toBeUndefined();
      expect(e.lastModified).toBeUndefined();
    }
  });

  // 사이트맵 한 파일의 상한. 넘으면 sitemap index로 쪼개야 한다.
  it("한 파일 상한 50,000 URL 안에 있다", () => {
    expect(urls.length).toBeLessThanOrEqual(50_000);
  });
});
