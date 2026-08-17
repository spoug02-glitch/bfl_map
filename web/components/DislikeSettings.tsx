"use client";

import { useState } from "react";
import { DISLIKE_PRESETS, setDislikes, useDislikes } from "@/lib/dislikes";

/**
 * 안 먹는 음식 설정. "나" 탭에만 있다 — 오늘 하루의 조건이 아니라 그 사람의
 * 상수라서, 매번 만지는 필터 바가 아니라 설정에 있어야 한다.
 *
 * 여기서 정한 건 룰렛 랜덤에만 걸린다. 지도와 목록은 그 동네에 뭐가 있는지를
 * 보여주는 화면이라 손대지 않는다.
 */
export default function DislikeSettings() {
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
      {/* 꺼진 칩은 꺼져 보여야 한다. 흰 바탕에 진한 볼드로 두면 여섯 개가 전부
          "이미 빼고 있는 것"으로 읽힌다 — 하나도 안 골랐는데도. 그래서 평소엔
          흐린 글씨에 + 를 달아 "누르면 추가"로 읽히게 하고, 고른 것만 채운다. */}
      <div className="flex flex-wrap gap-2 py-2.5">
        {DISLIKE_PRESETS.map(p => {
          const picked = dislikes.presets.includes(p.key);
          return (
            <button
              key={p.key}
              aria-pressed={picked}
              className={`flex h-9 items-center gap-1 rounded-xl border px-3 text-xs font-bold ${
                picked
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant"
              }`}
              onClick={() => toggle(p.key)}
            >
              {!picked && <span aria-hidden className="text-sm leading-none">+</span>}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant"
          // 브랜드 이름도 먹지만 예시로는 쓰지 않는다 — 특정 가게를 앱이 지목하는
          // 모양이 된다. 음식 이름으로만 예를 든다.
          placeholder="직접 적기 (예: 고수, 오이)"
          value={draft}
          maxLength={20}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
        />
        <button
          className="h-11 shrink-0 rounded-lg bg-surface-container px-4 text-sm font-bold text-on-surface disabled:opacity-50"
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
              className="flex h-9 items-center gap-1.5 rounded-xl border border-primary bg-primary px-3 text-xs font-bold text-on-primary"
              aria-label={`${w} 빼기`}
              onClick={() => removeCustom(w)}
            >
              {w}<span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-on-surface-variant">
        {on
          ? "룰렛 랜덤에서 빼요. 그 음식이 그 집의 주 메뉴일 때만 빼고, 지도와 목록에는 그대로 있어요. 검색으로는 담을 수 있어요."
          : "지금은 아무것도 빼고 있지 않아요. 고르면 룰렛 랜덤에서 빠지고, 이 브라우저에만 저장돼요."}
      </p>
    </>
  );
}
