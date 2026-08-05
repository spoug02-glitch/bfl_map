"use client";

import { OFFICE_LABEL, Restaurant, formatPrice } from "@/lib/constants";

export type ListedPlace = { place: Restaurant; distanceKm: number };

type Props = {
  places: ListedPlace[];
  onSelect: (r: Restaurant) => void;
  onWiden: () => void;
  onReset: () => void;
  canWiden: boolean;
};

/** 한 번에 그리는 최대 개수. 5,834개를 다 그리면 스크롤이 버벅인다. */
const MAX_ROWS = 50;

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// 가게 상세(PlacePanel)와 같은 자리를 쓴다 — 모바일은 하단 바텀시트,
// md 이상에서는 우측 사이드 패널. 가게를 고르면 이 자리가 상세로 바뀐다.
export default function PlaceList({ places, onSelect, onWiden, onReset, canWiden }: Props) {
  const shown = places.slice(0, MAX_ROWS);

  return (
    <aside
      // 모바일에서 이 시트가 커지면 지도가 사라진다. 헤더와 필터 바가 이미
      // 화면 위쪽을 많이 차지하므로 시트는 3분의 1 남짓으로 묶어 둔다.
      className="fixed inset-x-0 bottom-0 z-10 max-h-[34dvh] w-full overflow-y-auto
        rounded-t-2xl border-t border-border-subtle bg-surface px-4 pt-3 shadow-lg
        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0 md:pt-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <p className="text-sm text-text-muted">
        <span className="font-bold text-text-primary">{OFFICE_LABEL}</span> 기준 가까운 순
      </p>

      {shown.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-base font-bold text-text-primary">조건에 맞는 가게가 없어요</p>
          <p className="mt-1 text-sm text-text-muted">반경을 넓히거나 필터를 풀어보세요.</p>
          <div className="mx-auto mt-4 flex max-w-xs flex-col gap-2">
            <button
              className="grid h-11 place-items-center rounded-lg bg-ink text-sm font-bold text-white shadow-xs disabled:opacity-50"
              onClick={onWiden}
              disabled={!canWiden}
            >
              반경 넓히기
            </button>
            <button
              className="grid h-11 place-items-center rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
              onClick={onReset}
            >
              필터 초기화
            </button>
          </div>
        </div>
      ) : (
        <ul className="mt-1">
          {shown.map(({ place, distanceKm }) => {
            const top = place.menus[0];
            const price = top ? formatPrice(top.price) : null;
            return (
              <li key={place.kakao_place_id} className="border-b border-border-subtle/60 last:border-b-0">
                <button
                  className="flex w-full items-center gap-3 py-3 text-left"
                  onClick={() => onSelect(place)}
                >
                  <span className="w-14 shrink-0 text-sm font-bold text-accent">
                    {formatDistance(distanceKm)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-text-primary">
                      {place.name}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {place.category}
                      {price ? ` · ${top.name} ${price}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {places.length > shown.length && (
        <p className="py-3 text-center text-xs text-text-muted">
          가까운 {MAX_ROWS}곳만 보여주고 있어요 · 전체 {places.length}곳
        </p>
      )}
    </aside>
  );
}
