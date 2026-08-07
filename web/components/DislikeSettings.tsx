"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/constants";
import { DISLIKE_PRESETS, setDislikes, setPlaceHidden, useDislikes } from "@/lib/dislikes";

/**
 * 안 먹는 음식 설정. "나" 탭에만 있다 — 오늘 하루의 조건이 아니라 그 사람의
 * 상수라서, 매번 만지는 필터 바가 아니라 설정에 있어야 한다.
 */
export default function DislikeSettings({
  excludedCount, hiddenPlaces,
}: {
  excludedCount: number;
  /** 직접 뺀 가게들. 이름을 보여주려면 가게가 필요해 부모가 찾아 넘긴다. */
  hiddenPlaces: Restaurant[];
}) {
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
                  ? "border-ink bg-ink text-white"
                  : "border-border-subtle bg-surface text-text-muted"
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
          className="h-11 min-w-0 flex-1 rounded-lg bg-surface-muted px-3 text-base text-text-primary placeholder:text-text-muted"
          // 가게 이름과 메뉴에서 찾으므로 브랜드 이름이 잘 먹는다 — 예시로 알린다
          placeholder="직접 적기 (예: 고수, 써브웨이)"
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
          : "지금은 아무것도 빼고 있지 않아요. 고르면 지도·목록·룰렛에서 함께 빠지고, 이 브라우저에만 저장돼요."}
      </p>

      {/* 가게에서 직접 뺀 것들. 여기 말고는 되돌릴 자리가 없다 — 지도에서
          사라진 가게를 지도에서 다시 찾을 수는 없으니까. */}
      {hiddenPlaces.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold text-text-muted">내 지도에서 숨긴 가게</p>
          <ul className="mt-1 space-y-1">
            {hiddenPlaces.map(r => (
              <li key={r.kakao_place_id} className="flex items-center gap-2">
                {/* 이름만으로는 못 고른다 — 이 동네에만 "의정부부대찌개"가 네 곳이다.
                    업종과 거리를 붙여 어느 지점을 뺐는지 알 수 있게 한다. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">{r.name}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {r.category} · {r.distance_km < 1
                      ? `${Math.round(r.distance_km * 1000)}m`
                      : `${r.distance_km.toFixed(1)}km`}
                  </span>
                </span>
                <button
                  className="h-9 shrink-0 rounded-lg bg-surface-muted px-3 text-xs font-bold text-text-primary"
                  onClick={() => setPlaceHidden(r.kakao_place_id, false)}
                >
                  다시 보이기
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
