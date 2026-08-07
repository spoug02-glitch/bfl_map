"use client";

import { setPlaceHidden, useDislikes } from "@/lib/dislikes";

/**
 * 이 가게를 내 화면에서만 숨기기.
 *
 * 말과 크기를 일부러 낮춰 잡았다. 저장·공유와 같은 크기의 "이 가게 빼기"
 * 버튼은, 자기 가게 페이지를 열어본 사장님에게 "이 앱이 우리 가게를 빼라고
 * 한다"로 읽힌다. 실제로는 그 사람 브라우저에만 남는 화면 설정이라, 문구가
 * 그 사실을 먼저 말해야 한다 — 가게에 대한 판정이 아니라 내 지도 이야기다.
 */
export default function HidePlaceButton({ placeId }: { placeId: string }) {
  const dislikes = useDislikes();
  const hidden = dislikes.places.includes(placeId);

  return (
    <div className="mt-3 text-center">
      <button
        className="h-9 px-2 text-xs text-text-muted underline"
        aria-pressed={hidden}
        onClick={() => setPlaceHidden(placeId, !hidden)}
      >
        {hidden ? "다시 보이기" : "내 지도에서 숨기기"}
      </button>
      {hidden && (
        <p className="mt-1 text-xs text-text-muted">
          이 기기의 내 화면에서만 안 보여요. 다른 사람에게는 그대로 보입니다.
        </p>
      )}
    </div>
  );
}
