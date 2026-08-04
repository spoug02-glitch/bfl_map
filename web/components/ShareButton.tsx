"use client";

import Script from "next/script";
import { useState } from "react";
import { Restaurant } from "@/lib/constants";
import { shareDescription, sharePath, shareTitle } from "@/lib/share-copy";

// SRI 값은 버전마다 다르다 — 공식 다운로드 페이지에서 복사해 넣을 것
// https://developers.kakao.com/docs/latest/ko/javascript/download
const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js";

// 카카오 공유 SDK도 공식 @types가 없다 — 이 컴포넌트가 실제로 쓰는 부분만 선언한다.
interface KakaoShareLink { mobileWebUrl: string; webUrl: string }
interface KakaoShareGlobal {
  isInitialized(): boolean;
  init(key: string): void;
  Share?: {
    sendDefault(payload: {
      objectType: string;
      content: { title: string; description: string; link: KakaoShareLink };
      buttons: { title: string; link: KakaoShareLink }[];
    }): void;
  };
}

declare global {
  interface Window {
    Kakao: KakaoShareGlobal; // 지도 SDK의 전역은 소문자 `kakao`, 공유 SDK는 대문자 `Kakao` — 서로 다른 객체다
  }
}

function shareUrl(r: Restaurant): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
  // /place/<id> 여야 가게별 OG 태그가 붙는다 — 슬랙·디스코드에 붙여넣었을 때
  // 카드가 뜨는 건 이 경로뿐이다.
  return `${base}${sharePath(r.kakao_place_id)}`;
}

export default function ShareButton({ restaurant }: { restaurant: Restaurant }) {
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const initKakao = () => {
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) return; // 키가 없으면 폴백만 동작시킨다
    if (!window.Kakao?.isInitialized()) window.Kakao.init(key);
    setReady(true);
  };

  const copyLink = async () => {
    const url = shareUrl(restaurant);
    try {
      await navigator.clipboard.writeText(url);
      setManualUrl(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 쓰기는 권한·포커스·비보안 컨텍스트에서 거부된다. 조용히 실패하면
      // 버튼이 죽은 것처럼 보이므로, 직접 집어갈 수 있게 주소를 꺼내 보여준다.
      setManualUrl(url);
    }
  };

  const fallback = async () => {
    const url = shareUrl(restaurant);
    if (navigator.share) {
      try {
        await navigator.share({ title: restaurant.name, url });
        return;
      } catch {
        /* 사용자가 취소한 경우 — 복사로 넘어간다 */
      }
    }
    await copyLink();
  };

  const share = async () => {
    const url = shareUrl(restaurant);
    if (!ready || !window.Kakao?.Share) {
      await fallback();
      return;
    }
    const title = shareTitle(restaurant);
    const description = shareDescription(restaurant);
    try {
      // Feed 템플릿은 title/imageUrl/description 중 하나만 있으면 되므로 로고 없이도 동작한다.
      // 로고가 생기면 content.imageUrl에 우리가 만든 이미지 1종을 추가한다(가게 사진 금지).
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: { title, description, link: { mobileWebUrl: url, webUrl: url } },
        buttons: [{ title: "지도에서 보기", link: { mobileWebUrl: url, webUrl: url } }],
      });
    } catch {
      await fallback();
    }
  };

  return (
    <>
      <Script src={KAKAO_SDK_SRC} crossOrigin="anonymous" onLoad={initKakao} />
      <div className="mt-4 flex gap-2">
        <button
          className="grid h-11 flex-1 place-items-center rounded bg-brand-kakao text-base font-medium text-brand-kakao-text shadow-xs"
          onClick={share}
        >
          카카오톡으로 공유
        </button>
        {/* 슬랙·디스코드에는 붙여넣기가 곧 공유다 — 링크에 가게별 OG 태그가 붙어
            있어 채널에 그대로 카드가 그려진다. */}
        <button
          className="grid h-11 flex-1 place-items-center rounded border border-border text-base font-medium text-text-primary shadow-xs"
          onClick={copyLink}
        >
          {copied ? "복사했어요" : "링크 복사"}
        </button>
      </div>
      {manualUrl && (
        <div className="mt-2">
          <p className="text-xs text-text-muted">자동 복사가 막혔어요. 아래 주소를 직접 복사해주세요.</p>
          <input
            readOnly
            aria-label="공유 주소"
            className="mt-1 h-11 w-full rounded bg-surface-muted px-3 text-sm text-text-primary"
            value={manualUrl}
            onFocus={e => e.currentTarget.select()}
          />
        </div>
      )}
    </>
  );
}
