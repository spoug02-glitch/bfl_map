"use client";

import { useEffect, useState } from "react";
import { CONVENIENCE_NOTICE } from "@/lib/constants";

const VISIBLE_MS = 6000;
const FADE_MS = 400;

export default function EntryNotice() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const toFade = setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const toGone = setTimeout(() => setPhase("gone"), VISIBLE_MS + FADE_MS);
    return () => { clearTimeout(toFade); clearTimeout(toGone); };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-30 flex items-center gap-2 bg-warning px-4 py-2
        text-sm text-warning-text shadow-xs transition-opacity duration-[400ms]
        ${phase === "fading" ? "opacity-0" : "opacity-100"}`}
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <p className="flex-1 font-medium">⚠️ {CONVENIENCE_NOTICE}</p>
      <button
        aria-label="알림 닫기"
        className="grid h-11 w-11 shrink-0 place-items-center text-lg"
        onClick={() => setPhase("gone")}
      >
        ×
      </button>
    </div>
  );
}
