"use client";

import { OFFICE_LABEL, Restaurant, formatPrice } from "@/lib/constants";

export type ListedPlace = { place: Restaurant; distanceKm: number };
export type MyReview = {
  id: number;
  place_id: string;
  taste: number;
  convenience: number;
  body: string;
  created_at: string;
};

export type ListTab = "near" | "saved" | "mine";

type Props = {
  tab: ListTab;
  onTab: (t: ListTab) => void;
  places: ListedPlace[];
  savedPlaces: Restaurant[];
  myReviews: MyReview[];
  placeById: Map<string, Restaurant>;
  loggedIn: boolean;
  onSelect: (r: Restaurant) => void;
  onWiden: () => void;
  onReset: () => void;
  canWiden: boolean;
};

/** 한 번에 그리는 최대 개수. 5,834개를 다 그리면 스크롤이 버벅인다. */
const MAX_ROWS = 50;

const TABS: { key: ListTab; label: string }[] = [
  { key: "near", label: "주변" },
  { key: "saved", label: "저장" },
  { key: "mine", label: "내 리뷰" },
];

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function Row({
  title, subtitle, lead, onClick,
}: { title: string; subtitle: string; lead: string; onClick: () => void }) {
  return (
    <li className="border-b border-border-subtle/60 last:border-b-0">
      <button className="flex w-full items-center gap-3 py-3 text-left" onClick={onClick}>
        <span className="w-14 shrink-0 text-sm font-bold text-accent">{lead}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-text-primary">{title}</span>
          <span className="block truncate text-xs text-text-muted">{subtitle}</span>
        </span>
      </button>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-text-muted">{children}</p>;
}

// 가게 상세(PlacePanel)와 같은 자리를 쓴다 — 모바일은 하단 바텀시트,
// md 이상에서는 우측 사이드 패널. 가게를 고르면 이 자리가 상세로 바뀐다.
export default function PlaceList({
  tab, onTab, places, savedPlaces, myReviews, placeById,
  loggedIn, onSelect, onWiden, onReset, canWiden,
}: Props) {
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
      <div className="flex gap-1" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`h-11 flex-1 rounded-lg text-sm font-bold md:h-9 ${
              tab === t.key ? "bg-ink text-white" : "bg-surface-muted text-text-muted"
            }`}
            onClick={() => onTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "near" && (
        <>
          <p className="mt-3 text-sm text-text-muted">
            <span className="font-bold text-text-primary">{OFFICE_LABEL}</span> 기준 가까운 순
          </p>
          {shown.length === 0 ? (
            <div className="py-6 text-center">
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
                  <Row
                    key={place.kakao_place_id}
                    lead={formatDistance(distanceKm)}
                    title={place.name}
                    subtitle={place.category + (price ? ` · ${top.name} ${price}` : "")}
                    onClick={() => onSelect(place)}
                  />
                );
              })}
            </ul>
          )}
          {places.length > shown.length && (
            <p className="py-3 text-center text-xs text-text-muted">
              가까운 {MAX_ROWS}곳만 보여주고 있어요 · 전체 {places.length}곳
            </p>
          )}
        </>
      )}

      {tab === "saved" &&
        (!loggedIn ? (
          <Empty>로그인하면 가게를 저장해둘 수 있어요.</Empty>
        ) : savedPlaces.length === 0 ? (
          <Empty>아직 저장한 가게가 없어요. 가게를 열고 ☆ 저장을 눌러보세요.</Empty>
        ) : (
          // 저장 목록은 필터와 반경을 따르지 않는다 — 저장해둔 건 언제나 보여야 한다.
          <ul className="mt-1">
            {savedPlaces.map(place => (
              <Row
                key={place.kakao_place_id}
                lead={formatDistance(place.distance_km)}
                title={place.name}
                subtitle={place.category}
                onClick={() => onSelect(place)}
              />
            ))}
          </ul>
        ))}

      {tab === "mine" &&
        (!loggedIn ? (
          <Empty>로그인하면 내가 쓴 리뷰를 모아볼 수 있어요.</Empty>
        ) : myReviews.length === 0 ? (
          <Empty>아직 쓴 리뷰가 없어요.</Empty>
        ) : (
          <ul className="mt-1">
            {myReviews.map(rv => {
              const place = placeById.get(rv.place_id);
              // 수집을 다시 돌려 사라진 가게의 리뷰는 열 곳이 없으니 건너뛴다.
              if (!place) return null;
              return (
                <Row
                  key={rv.id}
                  lead={`★${rv.taste}`}
                  title={place.name}
                  subtitle={rv.body || `맛 ★${rv.taste} · 편의성 ★${rv.convenience}`}
                  onClick={() => onSelect(place)}
                />
              );
            })}
          </ul>
        ))}
    </aside>
  );
}
