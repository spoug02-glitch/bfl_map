"use client";

import { CATEGORY_GROUPS, CHEAP_LABEL } from "@/lib/constants";

type Props = {
  group: string | null; onGroup: (g: string | null) => void;
  query: string; onQuery: (q: string) => void;
  maxDist: number; onMaxDist: (d: number) => void;
  cheapOnly: boolean; onCheapOnly: (v: boolean) => void;
  /** 접힘 상태. 부모가 든다 — 지도를 만지면 접는 건 지도를 아는 쪽만 할 수 있다. */
  open: boolean | null; onOpenChange: (v: boolean) => void;
  count: number;
};

/** 접었을 때 지금 무엇이 걸려 있는지 한 줄로 알려준다. */
function summarize(query: string, group: string | null, maxDist: number, cheapOnly: boolean): string {
  const parts = [group ?? "전체", `반경 ${maxDist.toFixed(1)}km`];
  if (cheapOnly) parts.push(CHEAP_LABEL);
  if (query.trim()) parts.unshift(`"${query.trim()}"`);
  return parts.join(" · ");
}

export default function FilterBar({
  group, onGroup, query, onQuery, maxDist, onMaxDist, cheapOnly, onCheapOnly,
  open, onOpenChange, count,
}: Props) {
  /**
   * 아직 아무도 접거나 펴지 않은 상태가 null이다.
   *
   * 모바일에서 이 바가 화면 위쪽 269px을 먹어 지도가 211px밖에 안 남았다. 그래서
   * 휴대폰에서는 접힌 채로 시작해야 하는데, 그 판단을 상태로 하면 서버가 화면
   * 폭을 몰라 하이드레이션 때 한 번 펼쳐졌다 접히는 게 보인다. null인 동안에는
   * CSS가 폭을 보고 고르게 두고, 정해지는 순간부터 그 값이 CSS를 이긴다.
   *
   * 클래스는 조립하지 않고 통째로 적는다 — Tailwind는 소스에 리터럴로 있는
   * 이름만 만들어내서, 템플릿으로 이어붙이면 md: 규칙이 아예 생성되지 않는다.
   */
  const summaryClass = open === null ? "flex md:hidden" : open ? "hidden" : "flex";
  const bodyClass = open === null ? "hidden md:flex" : open ? "flex" : "hidden";

  return (
    <div className="shrink-0 border-b border-border-subtle bg-surface text-sm shadow-xs">
      {/* 접힌 줄 — 줄 전체가 펴는 표적이다 */}
      <button
        className={`${summaryClass} h-11 w-full items-center justify-between gap-3 px-4`}
        aria-expanded={false}
        aria-label="검색과 필터 펼치기"
        onClick={() => onOpenChange(true)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="text-text-muted">⌕</span>
          <span className="truncate font-medium text-text-primary">
            {summarize(query, group, maxDist, cheapOnly)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-text-muted">
          {count}곳<span aria-hidden>▾</span>
        </span>
      </button>

      <div className={`${bodyClass} flex-col gap-2 px-4 pt-2`}>
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
        {/* 반경과 가격은 둘 다 "여기까지"를 정하는 범위 조건이라 한 줄을 나눠 쓴다.
            업종 칩과 섞지 않는 이유는, 업종은 하나만 고르는 자리라 같은 줄에 두면
            가격도 배타 선택으로 읽히기 때문이다. */}
        <div className="flex items-center gap-2">
          {/* 채워진 쪽이 빈 쪽보다 진해야 "여기까지 선택됨"으로 읽힌다. 다만 ink
              (거의 검정)까지 가면 필터 칩의 선택 상태보다 도드라져 시선을 먼저
              가져가므로, 중간 톤 회색으로 둔다. */}
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 md:h-9">
            <span className="whitespace-nowrap font-medium text-text-muted">반경 {maxDist.toFixed(1)}km</span>
            <input
              type="range" min={0.5} max={5} step={0.5} value={maxDist}
              className="h-11 min-w-0 flex-1 accent-text-muted md:h-9"
              onChange={e => onMaxDist(Number(e.target.value))}
            />
          </label>
          <button
            className={`flex h-11 shrink-0 items-center justify-center rounded-xl border px-3 font-bold md:h-9 ${
              cheapOnly ? "border-price bg-price text-white" : "border-border bg-surface text-text-primary"
            }`}
            aria-pressed={cheapOnly}
            onClick={() => onCheapOnly(!cheapOnly)}
          >
            {CHEAP_LABEL}
          </button>
        </div>
        {/* 접는 표적은 가로 전체다. 오른쪽 끝 작은 버튼으로 뒀더니 누를 수 있다는
            걸 아무도 몰라, 모바일에서 지도가 계속 211px에 갇혀 있었다.
            펼친 상태에서 바 전체를 표적으로 삼지는 않는다 — 검색창을 누르려다
            접히기 때문이다. */}
        <button
          className="-mx-4 flex h-11 items-center justify-center gap-1.5 border-t border-border-subtle text-text-muted md:h-8"
          aria-expanded
          aria-label="검색과 필터 접기"
          onClick={() => onOpenChange(false)}
        >
          <span className="font-medium">{count}곳</span>
          <span aria-hidden>▴</span>
        </button>
      </div>
    </div>
  );
}
