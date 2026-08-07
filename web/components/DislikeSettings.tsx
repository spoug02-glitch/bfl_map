"use client";

import { useState } from "react";
import { DISLIKE_PRESETS, setDislikes, useDislikes } from "@/lib/dislikes";

/**
 * 안 먹는 음식 설정. "나" 탭에만 있다 — 오늘 하루의 조건이 아니라 그 사람의
 * 상수라서, 매번 만지는 필터 바가 아니라 설정에 있어야 한다.
 */
export default function DislikeSettings({ excludedCount }: { excludedCount: number }) {
  const dislikes = useDislikes();
  const [draft, setDraft] = useState("");

  const toggle = (key: string) =>
    setDislikes({
      ...dislikes,
      presets: dislikes.presets.includes(key)
        ? dislikes.presets.filter(k => k !== key)
        : [...dislikes.presets, key],
    });

  const addCustom = () => {
    const word = draft.trim();
    if (!word || dislikes.custom.includes(word)) return setDraft("");
    setDislikes({ ...dislikes, custom: [...dislikes.custom, word] });
    setDraft("");
  };

  const removeCustom = (word: string) =>
    setDislikes({ ...dislikes, custom: dislikes.custom.filter(w => w !== word) });

  const on = dislikes.presets.length > 0 || dislikes.custom.length > 0;

  return (
    <>
      <div className="flex flex-wrap gap-2 py-2.5">
        {DISLIKE_PRESETS.map(p => {
          const picked = dislikes.presets.includes(p.key);
          return (
            <button
              key={p.key}
              aria-pressed={picked}
              className={`flex h-9 items-center rounded-xl border px-3 text-xs font-bold ${
                picked ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-primary"
              }`}
              onClick={() => toggle(p.key)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-lg bg-surface-muted px-3 text-base text-text-primary placeholder:text-text-muted"
          placeholder="직접 적기 (예: 고수)"
          value={draft}
          maxLength={20}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
        />
        <button
          className="h-11 shrink-0 rounded-lg bg-surface-muted px-4 text-sm font-bold text-text-primary disabled:opacity-50"
          disabled={draft.trim().length === 0}
          onClick={addCustom}
        >
          추가
        </button>
      </div>

      {dislikes.custom.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {dislikes.custom.map(w => (
            <button
              key={w}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-ink bg-ink px-3 text-xs font-bold text-white"
              aria-label={`${w} 빼기`}
              onClick={() => removeCustom(w)}
            >
              {w}<span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-text-muted">
        {on
          ? `지금 ${excludedCount}곳이 빠져 있어요. 그 음식이 그 집의 주 메뉴일 때만 빼요 — 한식집 메뉴에 초밥 한 줄 있다고 빼지는 않아요.`
          : "고르면 지도·목록·룰렛에서 함께 빠져요. 이 브라우저에만 저장돼요."}
      </p>
    </>
  );
}
