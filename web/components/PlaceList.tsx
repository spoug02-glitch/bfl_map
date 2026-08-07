"use client";

import { OFFICE_LABEL, Restaurant, cheapestMenu, formatPrice } from "@/lib/constants";

export type ListedPlace = { place: Restaurant; distanceKm: number };
export type MyReview = {
  id: number;
  place_id: string;
  taste: number;
  convenience: number;
  body: string;
  created_at: string;
};

export type ListTab = "near" | "me";

type Props = {
  tab: ListTab;
  onTab: (t: ListTab) => void;
  places: ListedPlace[];
  savedPlaces: Restaurant[];
  myReviews: MyReview[];
  placeById: Map<string, Restaurant>;
  loggedIn: boolean;
  /** 가격 필터가 켜져 있는지. 켜져 있으면 줄에 대표메뉴 대신 통과 근거가 된 메뉴를 쓴다. */
  priceFiltered: boolean;
  /** 가격 필터 때문에 빠진, 메뉴 가격을 모르는 가게 수. 0이면 알리지 않는다. */
  unpricedCount: number;
  onSelect: (r: Restaurant) => void;
  onWiden: () => void;
  onReset: () => void;
  onLadder: () => void;
  canWiden: boolean;
};

/** 한 번에 그리는 최대 개수. 5,834개를 다 그리면 스크롤이 버벅인다. */
const MAX_ROWS = 50;

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

/** "나" 탭의 구획 머리띠. 박스가 아니라 시트 폭을 꽉 채우는 회색 바다. */
function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 mt-3 bg-surface-muted px-4 py-1.5 text-xs font-bold text-text-muted">
      {children}
    </div>
  );
}

// 가게 상세(PlacePanel)와 같은 자리를 쓴다 — 모바일은 하단 바텀시트,
// md 이상에서는 우측 사이드 패널. 가게를 고르면 이 자리가 상세로 바뀐다.
export default function PlaceList({
  tab, onTab, places, savedPlaces, myReviews, placeById,
  loggedIn, priceFiltered, unpricedCount, onSelect, onWiden, onReset, onLadder, canWiden,
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
      {/* 주변 | 사다리 | 나. 사다리는 탭이 아니라 패널을 여는 버튼이지만 같은
          줄에서 같은 크기로 산다 — 지도 위에 띄웠을 때는 가게를 하나 고르는
          순간 사라져 아무도 다시 찾지 못했다. 탭이 둘뿐이라 role=tablist 대신
          aria-current로 충분하다. */}
      <div className="flex gap-1">
        <button
          aria-current={tab === "near"}
          className={`h-11 flex-1 rounded-lg text-sm font-bold md:h-9 ${
            tab === "near" ? "bg-ink text-white" : "bg-surface-muted text-text-muted"
          }`}
          onClick={() => onTab("near")}
        >
          주변
        </button>
        {/* 색은 비선택 탭과 같게 — 혼자 진하면 셋 중 얘만 눌려 있는 걸로 읽힌다 */}
        <button
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-surface-muted text-sm font-bold text-text-muted md:h-9"
          onClick={onLadder}
        >
          <span aria-hidden>🪜</span>사다리
        </button>
        <button
          aria-current={tab === "me"}
          className={`h-11 flex-1 rounded-lg text-sm font-bold md:h-9 ${
            tab === "me" ? "bg-ink text-white" : "bg-surface-muted text-text-muted"
          }`}
          onClick={() => onTab("me")}
        >
          나
        </button>
      </div>

      {tab === "near" && (
        <>
          <p className="mt-3 text-sm text-text-muted">
            <span className="font-bold text-text-primary">{OFFICE_LABEL}</span> 기준 가까운 순
          </p>
          {/* 가격 필터를 켜면 후보의 절반 가까이가 조용히 사라진다 — 메뉴 가격이
              등록 안 된 곳이 그만큼 많다. 말없이 빼면 없는 줄 알게 된다. */}
          {unpricedCount > 0 && (
            <p className="mt-1 text-xs text-text-muted">
              가격이 등록 안 된 {unpricedCount}곳은 빠졌어요.
            </p>
          )}
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
                // 가격으로 걸렀으면 그 가게를 통과시킨 메뉴를 보여준다. 대표메뉴를
                // 그대로 쓰면 "1만원 이하"를 켜놓고 15,000원이 떠서 필터가 고장 난
                // 것처럼 읽힌다.
                const top = priceFiltered ? cheapestMenu(place.menus) : place.menus[0];
                const price = top ? formatPrice(top.price) : null;
                return (
                  <Row
                    key={place.kakao_place_id}
                    lead={formatDistance(distanceKm)}
                    title={place.name}
                    subtitle={place.category + (top && price ? ` · ${top.name} ${price}` : "")}
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

      {tab === "me" && (
        <>
          {/* 거리의 기준점. 지금은 모두 같은 곳이라 바꿀 수는 없고, 어디 기준인지
              보여주기만 한다. */}
          <SectionBar>회사</SectionBar>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">{OFFICE_LABEL}</span>
            <span className="shrink-0 text-xs text-text-muted">지금은 모두 여기 기준</span>
          </div>

          {!loggedIn ? (
            <Empty>로그인하면 저장한 맛집과 내가 쓴 리뷰가 여기 모여요.</Empty>
          ) : (
            <>
              <SectionBar>저장한 맛집</SectionBar>
              {savedPlaces.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">
                  아직 없어요. 가게를 열고 ☆ 저장을 눌러보세요.
                </p>
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
              )}

              <SectionBar>내 리뷰</SectionBar>
              {myReviews.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">아직 쓴 리뷰가 없어요.</p>
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
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}
