"use client";

import { useState } from "react";
import { LUNCH_CLOSED_MIN_REPORTS } from "@/lib/lunch-closed";

type Props = {
  placeId: string;
  /** 지금까지 모인 제보 수(내 것 포함). */
  reports: number;
  /** 내가 이미 눌렀는지. 눌렀으면 같은 버튼이 되돌리기가 된다. */
  mine: boolean;
  loggedIn: boolean;
  onChange: (placeId: string, reported: boolean) => void;
};

/**
 * "점심에 안 열어요" 제보 버튼.
 *
 * 저장(SaveButton)과 같은 자리·같은 모양이지만 성격이 반대다 — 저장은 나만
 * 보는 표시고, 이건 남의 목록에서 이 가게를 빼는 표다. 그래서 지금 몇 표인지,
 * 몇 표부터 빠지는지를 버튼 아래에 그대로 적는다.
 */
export default function LunchClosedButton({ placeId, reports, mine, loggedIn, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!loggedIn) return null;

  const toggle = async () => {
    setError("");
    setBusy(true);
    const next = !mine;
    const res = await fetch(
      next ? "/api/lunch-closed" : `/api/lunch-closed?placeId=${encodeURIComponent(placeId)}`,
      next
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeId }),
          }
        : { method: "DELETE" },
    ).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? "제보를 보내지 못했어요.");
      return;
    }
    // 서버가 받아들인 뒤에 화면을 바꾼다 — 실패했는데 보낸 것처럼 보이면 안 된다.
    onChange(placeId, next);
  };

  const left = LUNCH_CLOSED_MIN_REPORTS - reports;

  return (
    <>
      <button
        className={`mt-2 grid h-11 w-full place-items-center rounded border text-base font-medium shadow-xs transition-colors disabled:opacity-50 ${
          mine
            ? "border-primary bg-primary hover:bg-primary/90 active:bg-primary/80 text-on-primary"
            : "border-outline bg-surface-container-lowest text-on-surface hover:bg-on-surface/8 active:bg-on-surface/10"
        }`}
        aria-pressed={mine}
        disabled={busy}
        onClick={toggle}
      >
        {mine ? "🕛 점심에 안 연다고 제보함" : "🕛 점심에 안 열어요"}
      </button>
      <p className="mt-1 text-xs text-on-surface-variant">
        {reports === 0
          ? `${LUNCH_CLOSED_MIN_REPORTS}명이 제보하면 점심 목록에서 빠져요.`
          : left > 0
            ? `${reports}명이 제보했어요. ${left}명 더 모이면 점심 목록에서 빠져요.`
            : `${reports}명이 제보해서 점심 목록에서 빠져 있어요.`}
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}
