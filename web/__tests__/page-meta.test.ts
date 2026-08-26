import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { pageMetadata } from "@/lib/page-meta";
import { metadata as rootMeta } from "@/app/layout";
import { metadata as homeMeta } from "@/app/page";
import { metadata as aboutMeta } from "@/app/(docs)/about/page";
import { metadata as contactMeta } from "@/app/(docs)/contact/page";
import { metadata as reportMeta } from "@/app/(docs)/report/page";
import { metadata as ownerMeta } from "@/app/(docs)/owner/page";
import { metadata as privacyMeta } from "@/app/(docs)/privacy/page";
import { metadata as termsMeta } from "@/app/(docs)/terms/page";

/** 사이트맵에 실리는 정적 경로 전부. 사이트맵과 이 목록은 같이 움직여야 한다. */
const PAGES: [string, Metadata][] = [
  ["/", homeMeta],
  ["/about", aboutMeta],
  ["/contact", contactMeta],
  ["/report", reportMeta],
  ["/owner", ownerMeta],
  ["/privacy", privacyMeta],
  ["/terms", termsMeta],
];

describe("pageMetadata", () => {
  it("canonical과 og:url을 같은 경로로 만든다", () => {
    const meta = pageMetadata({ path: "/about", title: "서비스 소개", description: "설명" });
    expect(meta.alternates?.canonical).toBe("/about");
    expect(meta.openGraph?.url).toBe("/about");
  });

  // openGraph는 부모(layout)와 깊게 병합되지 않는다 — 자식이 쓰는 순간 레이아웃이
  // 지정한 이미지가 통째로 사라진다. 헬퍼가 매번 같이 넣어야 하는 이유다.
  it("openGraph를 새로 쓰면서 공유 카드 이미지를 잃지 않는다", () => {
    const meta = pageMetadata({ path: "/terms", title: "이용약관", description: "설명" });
    expect(meta.openGraph?.images).toBeDefined();
    expect(meta.twitter?.images).toBeDefined();
  });

  it("og:title은 페이지 제목을 따라간다", () => {
    const meta = pageMetadata({ path: "/report", title: "제보", description: "설명" });
    expect(meta.openGraph?.title).toBe("제보");
    expect(meta.title).toBe("제보");
  });
});

describe("페이지별 canonical", () => {
  // 2026-08-26 라이브: 루트 레이아웃의 alternates.canonical을 8개 경로가 전부
  // 물려받아 모두 홈을 정본으로 신고하고 있었다. 안내 페이지를 색인에서
  // 빼달라는 요청과 같다. 전역 선언이 다시 생기면 이 테스트가 잡는다.
  it("루트 레이아웃은 canonical을 선언하지 않는다", () => {
    expect(rootMeta.alternates?.canonical).toBeUndefined();
  });

  it("루트 레이아웃은 og:url을 선언하지 않는다", () => {
    expect(rootMeta.openGraph?.url).toBeUndefined();
  });

  it.each(PAGES)("%s 는 자기 경로를 canonical로 쓴다", (path, meta) => {
    expect(meta.alternates?.canonical).toBe(path);
  });

  it.each(PAGES)("%s 의 og:url은 canonical과 같다", (path, meta) => {
    expect(meta.openGraph?.url).toBe(path);
  });

  it("일곱 경로의 canonical이 서로 다르다", () => {
    const canonicals = new Set(PAGES.map(([, meta]) => meta.alternates?.canonical));
    expect(canonicals.size).toBe(PAGES.length);
  });
});
