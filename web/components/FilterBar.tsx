"use client";

import { useState } from "react";
import { CATEGORY_GROUPS } from "@/lib/constants";

type Props = {
  group: string | null; onGroup: (g: string | null) => void;
  query: string; onQuery: (q: string) => void;
  maxDist: number; onMaxDist: (d: number) => void;
  count: number;
};

/** 접었을 때 지금 무엇이 걸려 있는지 한 줄로 알려준다. */
function summarize(query: string, group: string | null, maxDist: number): string {
  const parts = [group ?? "전체", `반경 ${maxDist.toFixed(1)}km`];
  if (query.trim()) parts.unshift(`"${query.trim()}"`);
  return parts.join(" · ");
}

export default function FilterBar({ group, onGroup, query, onQuery, maxDist, onMaxDist, count }: Props) {
  // 모바일에서 이 바가 화면 위쪽 270px 남짓을 먹어 지도가 밀린다. 접어서
  // 돌려줄 수 있게 한다. 기본은 펼침 — 처음 온 사람에게 필터가 보여야 한다.
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="border-b border-border-subtle bg-surface px-4 text-sm shadow-xs">
        <button
          className="flex h-11 w-full items-center justify-between gap-3"
          aria-expanded={false}
          aria-label="검색과 필터 펼치기"
          onClick={() => setOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-text-muted">⌕</span>
            <span className="truncate font-medium text-text-primary">
              {summarize(query, group, maxDist)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-text-muted">
            {count}곳<span aria-hidden>▾</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle bg-surface px-4 py-2 text-sm shadow-xs">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
          ⌕
        </span>
        <input
          className="h-11 w-full rounded-lg border-0 bg-surface-muted pl-10 pr-4 text-base md:h-9 text-text-primary placeholder:text-text-muted focus:outline-2 focus:outline-accent"
          placeholder="가게 이름 검색"
          value={query}
          onChange={e => onQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3.5 font-bold md:h-9 md:min-w-9 ${
            group === null ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-primary"
          }`}
          onClick={() => onGroup(null)}
        >
          전체
        </button>
        {Object.keys(CATEGORY_GROUPS).map(g => (
          <button
            key={g}
            className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3.5 font-bold md:h-9 md:min-w-9 ${
              group === g ? "border-ink bg-ink text-white" : "border-border bg-surface text-text-primary"
            }`}
            onClick={() => onGroup(group === g ? null : g)}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {/* 채워진 쪽이 빈 쪽보다 진해야 "여기까지 선택됨"으로 읽힌다. 다만 ink
            (거의 검정)까지 가면 필터 칩의 선택 상태보다 도드라져 시선을 먼저
            가져가므로, 중간 톤 회색으로 둔다. */}
        <label className="flex h-11 flex-1 items-center gap-3 md:h-8">
          <span className="whitespace-nowrap font-medium text-text-muted">반경 {maxDist.toFixed(1)}km</span>
          <input
            type="range" min={0.5} max={5} step={0.5} value={maxDist}
            className="h-11 flex-1 accent-text-muted md:h-8"
            onChange={e => onMaxDist(Number(e.target.value))}
          />
        </label>
        {/* 개수와 화살표를 한 버튼으로 묶는다. 화살표만 누르게 두면 모바일에서
            32px짜리 표적이 되고, 접힌 줄의 "{count}곳 ▾"와도 모양이 어긋난다. */}
        <button
          className="flex h-11 shrink-0 items-center gap-1 whitespace-nowrap px-1 text-text-muted md:h-8"
          aria-expanded
          aria-label="검색과 필터 접기"
          onClick={() => setOpen(false)}
        >
          {count}곳<span aria-hidden>▴</span>
        </button>
      </div>
    </div>
  );
}
