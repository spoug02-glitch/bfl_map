"use client";

import { useState } from "react";

type Props = {
  placeId: string;
  saved: boolean;
  loggedIn: boolean;
  onChange: (placeId: string, saved: boolean) => void;
};

export default function SaveButton({ placeId, saved, loggedIn, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!loggedIn) return null;

  const toggle = async () => {
    setError("");
    setBusy(true);
    const next = !saved;
    const res = await fetch(
      next ? "/api/saved" : `/api/saved?placeId=${encodeURIComponent(placeId)}`,
      next
        ? {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeId }),
          }
        : { method: "DELETE" },
    ).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setError("저장 상태를 바꾸지 못했어요.");
      return;
    }
    // 서버가 받아들인 뒤에 화면을 바꾼다 — 실패했는데 저장된 것처럼 보이면 안 된다.
    onChange(placeId, next);
  };

  return (
    <>
      <button
        className={`mt-4 grid h-11 w-full place-items-center rounded border text-base font-medium shadow-xs disabled:opacity-50 ${
          saved ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-primary"
        }`}
        aria-pressed={saved}
        disabled={busy}
        onClick={toggle}
      >
        {saved ? "★ 저장됨" : "☆ 저장"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}
