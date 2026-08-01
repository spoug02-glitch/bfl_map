import type { Metadata } from "next";
import "./globals.css";

// No next/font/google here on purpose. This Next build's font dataset has NO
// font with a "korean" subset (verified: every entry in the bundled
// font-data.json lacks it, and Noto Sans KR itself only offers
// cyrillic/latin/latin-ext/vietnamese). Importing it would download a webfont
// that cannot render a single character of this app's almost entirely Korean
// UI, while Hangul silently fell back to the OS font anyway. Pretendard is
// served from a CDN instead — it is the de-facto Korean UI font and matches
// the Figma design's intent far better than a platform-dependent fallback.

export const metadata: Metadata = {
  title: "직장인 맛집지도",
  description: "창동씨드큐브 반경 5km 비플페이(제로페이) 맛집 지도",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
