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
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
      <input
        className="h-11 w-40 max-w-full rounded border px-2"
        placeholder="가게 이름 검색"
        value={query}
        onChange={e => onQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1">
        <button
          className={`flex h-11 min-w-11 items-center justify-center rounded-full border px-3 ${group === null ? "bg-black text-white" : ""}`}
          onClick={() => onGroup(null)}
        >
          전체
        </button>
        {Object.keys(CATEGORY_GROUPS).map(g => (
          <button
            key={g}
            className={`flex h-11 min-w-11 items-center justify-center rounded-full border px-3 ${group === g ? "bg-black text-white" : ""}`}
            onClick={() => onGroup(group === g ? null : g)}
          >
            {g}
          </button>
        ))}
      </div>
      <label className="ml-auto flex h-11 items-center gap-2">
        반경 {maxDist.toFixed(1)}km
        <input
          type="range" min={0.5} max={5} step={0.5} value={maxDist}
          className="h-11"
          onChange={e => onMaxDist(Number(e.target.value))}
        />
      </label>
      <span className="text-gray-500">{count}곳</span>
    </div>
  );
}
