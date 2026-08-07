"use client";

import { setPlaceHidden, useDislikes } from "@/lib/dislikes";

/**
 * 이 가게만 빼기.
 *
 * 음식 종류로는 못 거르는 게 있다 — 저 집은 그냥 안 가고 싶다든가. 키워드를
 * 짜내게 하는 대신 가게에서 바로 뺀다. 뺀 뒤에도 이 화면은 그대로 열려 있어서
 * 바로 되돌릴 수 있다(지도와 목록에서는 이미 사라진 상태다).
 */
export default function HidePlaceButton({ placeId }: { placeId: string }) {
  const dislikes = useDislikes();
  const hidden = dislikes.places.includes(placeId);

  return (
    <button
      className={`mt-2 h-11 w-full rounded-lg text-sm font-bold ${
        hidden ? "bg-ink text-white" : "bg-surface-muted text-text-muted"
      }`}
      aria-pressed={hidden}
      onClick={() => setPlaceHidden(placeId, !hidden)}
    >
      {hidden ? "다시 보이기" : "이 가게 빼기"}
    </button>
  );
}
