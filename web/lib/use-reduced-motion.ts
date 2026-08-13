"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * 움직임을 줄여달라는 설정을 읽는다.
 *
 * CSS 미디어 쿼리로 끌 수 없는 애니메이션이 있다 — 재생 시간을 인라인 스타일로
 * 넣으면 스타일시트가 이기지 못한다. 그런 자리에서 이 값으로 직접 분기한다.
 *
 * useSyncExternalStore를 쓰는 이유: matchMedia는 서버에 없고, effect에서 상태를
 * 세우면 첫 프레임에 이미 애니메이션이 시작된 뒤다. 서버 스냅샷은 false로 둔다 —
 * 모르는 상태에서는 평소 동작을 보이고, 클라이언트가 붙는 즉시 바로잡는다.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
