"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_ID } from "@/lib/gtag";

/**
 * GA4 스크립트 로더.
 *
 * /admin 아래에서는 아예 로드하지 않는다 — 운영자(=사이트 주인)의 트래픽이
 * 지표를 오염시키면 "어느 유입이 전환되는가"라는 질문 자체가 무의미해진다.
 *
 * page_view는 여기서 수동으로 보내지 않는다. Google 태그의 향상된 측정이
 * 브라우저 기록 변경을 감지해 자동으로 보내므로, 여기서 또 보내면 두 번 잡힌다.
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();
  if (!GA_ID) return null;
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
