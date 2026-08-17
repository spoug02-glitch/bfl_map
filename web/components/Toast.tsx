"use client";

import { useEffect } from "react";

/** 화면에 머무는 시간(ms). globals.css의 toast-in-out 재생 시간과 같아야 한다. */
const TOAST_MS = 3200;

/**
 * 저절로 사라지는 알림.
 *
 * 닫는 버튼은 달지 않는다 — 읽기도 전에 누르게 되고, 안 누르면 화면에 남는다.
 * 스스로 빠지는 쪽이 읽히기도 더 낫다.
 */
export default function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      // 시트(z-20)보다 위. 헤더와 필터 바를 피해 위쪽에 띄운다 — 아래는 패널이
      // 차지하고 있어 가릴 자리가 없다.
      // inverse-on-surface(#ffeede) on inverse-surface(#3c2e1d) 대비 11.6:1 — 기준 4.5:1 여유 있게 통과.
      className="toast pointer-events-none fixed inset-x-0 top-20 z-30 mx-auto w-fit
        max-w-[min(90vw,22rem)] rounded-lg bg-inverse-surface px-4 py-2.5 text-center
        text-sm font-medium text-inverse-on-surface shadow-elevation-3"
    >
      {message}
    </div>
  );
}
