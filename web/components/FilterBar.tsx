"use client";

import { CATEGORY_GROUPS } from "@/lib/constants";

type Props = {
  group: string | null; onGroup: (g: string | null) => void;
  query: string; onQuery: (q: string) => void;
  maxDist: number; onMaxDist: (d: number) => void;
  count: number;
};

export default function FilterBar({ group, onGroup, query, onQuery, maxDist, onMaxDist, count }: Props) {
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
        {/* 반경 슬라이더는 보조 조작이다. ink(거의 검정)로 칠하면 필터 칩의
            선택 상태보다 더 도드라져 시선을 먼저 가져간다. */}
        <label className="flex h-11 flex-1 items-center gap-3 md:h-8">
          <span className="whitespace-nowrap font-medium text-text-muted">반경 {maxDist.toFixed(1)}km</span>
          <input
            type="range" min={0.5} max={5} step={0.5} value={maxDist}
            className="h-11 flex-1 accent-border md:h-8"
            onChange={e => onMaxDist(Number(e.target.value))}
          />
        </label>
        <span className="whitespace-nowrap text-text-muted">{count}곳</span>
      </div>
    </div>
  );
}
