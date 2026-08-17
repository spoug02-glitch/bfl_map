import type { Metadata } from "next";
import { OG_CARD_PATH } from "@/lib/constants";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
  title: SITE_NAME,
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "맛창고", statusBarStyle: "default" },
  openGraph: {
    siteName: SITE_NAME,
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
      </head>
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
