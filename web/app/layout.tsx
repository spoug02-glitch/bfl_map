import type { Metadata } from "next";
import { OG_CARD_PATH, SITE_URL } from "@/lib/constants";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "./globals.css";

// No next/font/google here on purpose. This Next build's font dataset has NO
// font with a "korean" subset (verified: every entry in the bundled
// font-data.json lacks it, and Noto Sans KR itself only offers
// cyrillic/latin/latin-ext/vietnamese). Importing it would download a webfont
// that cannot render a single character of this app's almost entirely Korean
// UI, while Hangul silently fell back to the OS font anyway. Pretendard is
// served from a CDN instead — it is the de-facto Korean UI font and matches
// the Figma design's intent far better than a platform-dependent fallback.

const SITE_NAME = "직장인 맛창고";
const DESCRIPTION = "창동씨드큐브 반경 5km 비플페이(제로페이) 맛집 지도";

export const metadata: Metadata = {
  // 공유 카드의 이미지 주소는 절대 경로여야 한다. 이게 없으면 og:image가
  // "/og-card.png"로 나가고 슬랙은 그걸 가져오지 못한다.
  // 폴백이 localhost면 배포 환경에 NEXT_PUBLIC_BASE_URL을 빠뜨린 순간 canonical과
  // og:image가 통째로 localhost로 나간다. 폴백은 정식 도메인이어야 안전하다.
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? SITE_URL),
  title: SITE_NAME,
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "맛창고", statusBarStyle: "default" },
  // 지도는 필터·좌표가 쿼리로 붙는데 그건 전부 같은 문서다. 정식 주소를 못박아
  // 두지 않으면 검색엔진이 쿼리별로 다른 페이지로 세어 색인이 쪼개진다.
  alternates: { canonical: "/" },
  // 검색엔진 소유권 확인. 네이버는 메타 태그만 받고, 구글은 파일 방식이라
  // public/google5b8ff07028b28e0a.html이 짝이다 — 한쪽만 지우면 확인이 풀린다.
  verification: {
    other: { "naver-site-verification": "7442d41237854c4289708a51bb6fab71f58d769a" },
  },
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DESCRIPTION,
    url: SITE_URL,
    type: "website",
    locale: "ko_KR",
    images: [{ url: OG_CARD_PATH, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [OG_CARD_PATH] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* Google AdSense 사이트 소유권 확인 스니펫. Google이 "각 페이지의 head" 를
            명시적으로 요구해서, next/script가 아니라 정적 <head> 안에 그대로 둔다 —
            afterInteractive 전략은 hydration 이후에나 실행되어 verification
            크롤러가 초기 HTML에서 못 찾을 수 있다. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3893735525022642"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
