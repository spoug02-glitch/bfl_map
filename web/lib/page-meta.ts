import type { Metadata } from "next";
import { OG_CARD_PATH, SERVICE } from "@/lib/constants";

type PageMeta = {
  /** 이 페이지의 정식 경로. canonical과 og:url이 같이 쓴다. */
  path: string;
  title: string;
  description: string;
};

/**
 * 페이지 하나의 <head>.
 *
 * canonical은 **페이지가 자기 것을 말해야 한다**. 2026-08-26 이전에는 루트 레이아웃이
 * `alternates: { canonical: "/" }`를 한 번 선언했고, /about부터 /place/[id]까지 여덟
 * 경로가 그걸 그대로 물려받아 전부 홈을 정본으로 신고했다 — 검색엔진에 "이 페이지는
 * 홈의 중복이니 색인에서 빼라"고 요청한 것과 같다. 지도의 쿼리 파라미터를 겨냥한
 * 규칙이었는데 적용 범위가 사이트 전체였다.
 *
 * og:image와 twitter를 매번 다시 넣는 이유: Next의 openGraph는 부모와 깊게 병합되지
 * 않는다. 자식이 openGraph를 한 줄이라도 쓰면 레이아웃이 지정한 이미지가 통째로
 * 사라진다. canonical과 og:url을 한 함수에서 만드는 것도 같은 이유다 — 따로 두면
 * 조용히 갈라진다.
 */
export function pageMetadata({ path, title, description }: PageMeta): Metadata {
  const images = [{ url: OG_CARD_PATH, width: 1200, height: 630 }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      siteName: SERVICE.name,
      title,
      description,
      url: path,
      type: "website",
      locale: "ko_KR",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_CARD_PATH] },
  };
}
