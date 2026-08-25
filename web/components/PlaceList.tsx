"use client";

import DislikeSettings from "@/components/DislikeSettings";
import { OFFICE_LABEL, Restaurant, SpecialPrice, formatPrice } from "@/lib/constants";
import { useEffect, useRef, useState } from "react";

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
  /** 가게별 최저가 점심특선 제보. 제보 덕에 통과한 줄에는 그 특선을 보여준다. */
  specialPrices: Map<string, SpecialPrice>;
  /** 가게별 확정(published) 메뉴 최저가. 이것 때문에 통과한 줄에는 이 값을 보여준다. */
  dbMinPrices: Map<string, number>;
  /** 가격 필터 때문에 빠진, 메뉴 가격을 모르는 가게 수. 0이면 알리지 않는다. */
  unpricedCount: number;
  /** 지도에서 뭉친 원을 탭해 그 구역만 보고 있으면 그 개수. 아니면 null. */
  clusterCount: number | null;
  onClearCluster: () => void;
  onSelect: (r: Restaurant) => void;
  onWiden: () => void;
  onReset: () => void;
  onRoulette: () => void;
  canWiden: boolean;
  /** 기준점이 회사가 아닌 지점으로 옮겨져 있는지. 문구와 되돌리기가 여기 달렸다. */
  originMoved: boolean;
  onResetOrigin: () => void;
  /** 기준점 기준 거리. 저장 목록 줄에 쓴다 — 목록(places)은 부모가 이미 계산해 준다. */
  distKm: (r: Restaurant) => number;
};

/** 한 번에 그리는 개수. 5,834개를 다 그리면 스크롤이 버벅인다. 더 보기로 이만큼씩 늘린다. */
const PAGE_ROWS = 50;

/**
 * 시트가 멈춰 서는 높이(dvh). 34%는 지도가 주인공인 기본 자세, 88%는 목록만
 * 보는 자세, 62%는 그 사이에서 지도도 목록도 남는 자세다.
 *
 * 34% 하나로 고정돼 있었더니 한 화면에 세 줄 반이라, 가까운 50곳을 훑으려면
 * 좁은 창으로 계속 긁어야 했다(2026-08-25 제보).
 */
const SNAPS = [34, 62, 88];
/** 이 이하로 움직였으면 끌었다고 보지 않고 탭으로 친다(px). */
const TAP_SLOP = 6;

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function Row({
  title, subtitle, lead, onClick,
}: { title: string; subtitle: string; lead: string; onClick: () => void }) {
  return (
    <li className="border-b border-outline-variant/60 last:border-b-0">
      <button
        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
        onClick={onClick}
      >
        <span className="w-14 shrink-0 text-sm font-bold text-primary">{lead}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-on-surface">{title}</span>
          <span className="block truncate text-xs text-on-surface-variant">{subtitle}</span>
        </span>
      </button>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-on-surface-variant">{children}</p>;
}

/** "나" 탭의 구획 머리띠. 박스가 아니라 시트 폭을 꽉 채우는 회색 바다. */
function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 mt-3 bg-surface-container px-4 py-1.5 text-xs font-bold text-on-surface-variant">
      {children}
    </div>
  );
}

// 가게 상세(PlacePanel)와 같은 자리를 쓴다 — 모바일은 하단 바텀시트,
// md 이상에서는 우측 사이드 패널. 가게를 고르면 이 자리가 상세로 바뀐다.
export default function PlaceList({
  tab, onTab, places, savedPlaces, myReviews, placeById,
  loggedIn, priceFiltered, specialPrices, dbMinPrices, unpricedCount,
  clusterCount, onClearCluster,
  onSelect, onWiden, onReset, onRoulette, canWiden,
  originMoved, onResetOrigin, distKm,
}: Props) {
  const [rows, setRows] = useState(PAGE_ROWS);
  // 필터·반경을 바꾸면 다른 목록이다. 200번째 줄까지 펼친 상태로 남으면
  // 새 조건에서는 없는 자리라 빈 화면처럼 보인다. places는 부모가 useMemo로
  // 쥐고 있어 필터가 바뀔 때만 새 배열이 된다 — effect가 아니라 렌더 중에
  // 맞추는 쪽이 한 박자 늦게 그려지는 일이 없다.
  const [seenPlaces, setSeenPlaces] = useState(places);
  if (places !== seenPlaces) {
    setSeenPlaces(places);
    setRows(PAGE_ROWS);
  }
  const shown = places.slice(0, rows);

  /** 몇 번째 정지 높이에 서 있는지. md 이상은 우측 사이드 패널이라 쓰이지 않는다. */
  const [snap, setSnap] = useState(0);
  /** 끄는 동안의 높이(dvh). 놓으면 null로 돌아가고 가장 가까운 정지 높이에 붙는다. */
  const [dragging, setDragging] = useState<number | null>(null);
  const drag = useRef<{ y: number; from: number; moved: number } | null>(null);
  /** 방금 끝난 게 드래그였는지. 뒤따라오는 click이 한 칸 더 올리지 않게 막는다. */
  const dragged = useRef(false);

  /**
   * 시트 높이는 모바일에서만 우리가 정한다. md 이상은 화면 높이를 꽉 채워야
   * 하는데 인라인 height는 어떤 클래스도 못 이겨 사이드 패널이 3분의 1로
   * 잘린다. 그래서 폭을 직접 물어보고 그때만 건다. 하이드레이션 전에는
   * 클래스(h-[34dvh])가 기본 자세를 잡는다.
   */
  const [isSheet, setIsSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsSheet(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // 뭉친 원을 탭한 건 "그 안에 뭐가 있나" 보려는 것이다. 34% 자세 그대로면
  // 세 줄 반만 보여, 정작 탭한 이유가 화면 밖에 남는다. 위의 rows와 같은 방식으로
  // effect가 아니라 렌더 중에 맞춘다 — 한 박자 늦게 커지면 시트가 들썩인다.
  const [seenCluster, setSeenCluster] = useState(clusterCount);
  if (clusterCount !== seenCluster) {
    setSeenCluster(clusterCount);
    if (clusterCount !== null && snap === 0) setSnap(1);
  }

  const height = dragging ?? SNAPS[snap];

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, from: SNAPS[snap], moved: 0 };
    // 손가락이 시트 밖으로 나가도 계속 따라오게. 잡을 수 없는 포인터면 캡처
    // 없이 진행한다 — 이것 때문에 탭까지 죽으면 안 된다.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 있으면 좋은 것 */ }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;  // 위로 끌면 커진다
    d.moved = Math.max(d.moved, Math.abs(dy));
    // 정지 높이를 조금 넘어가는 건 허용한다 — 딱 잘리면 손가락이 걸린 느낌이 난다.
    setDragging(Math.min(92, Math.max(20, d.from + (dy / window.innerHeight) * 100)));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (!d) return;
    // 탭이면 여기서 아무것도 하지 않는다 — 뒤이어 오는 click이 처리한다.
    // 그래야 키보드 Enter도 같은 길을 탄다(button인데 눌러도 안 움직이면 고장이다).
    if (d.moved <= TAP_SLOP) return;
    dragged.current = true;
    const at = dragging ?? d.from;
    let best = 0;
    for (let i = 1; i < SNAPS.length; i++) {
      if (Math.abs(SNAPS[i] - at) < Math.abs(SNAPS[best] - at)) best = i;
    }
    setSnap(best);
  };
  /** 끌 수 있다는 걸 모르는 사람도, 키보드를 쓰는 사람도 한 번 눌러 다음 높이로. */
  const onGrabClick = () => {
    if (dragged.current) { dragged.current = false; return; }
    setSnap(s => (s + 1) % SNAPS.length);
  };

  return (
    <aside
      // 모바일은 하단 시트, md 이상은 우측 사이드 패널.
      // h-[34dvh]는 하이드레이션 전 기본 자세다 — 붙고 나면 손잡이가 정한
      // 높이를 인라인으로 덮어쓴다(모바일에서만, isSheet 주석 참조).
      className={`fixed inset-x-0 bottom-0 z-10 flex h-[34dvh] w-full flex-col
        rounded-t-2xl border-t border-outline-variant bg-surface-container-low px-4 shadow-elevation-3
        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full
        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0 md:pt-4
        ${dragging === null ? "transition-[height] duration-200" : ""}`}
      style={{
        height: isSheet ? `${height}dvh` : undefined,
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* 손잡이. 끌면 높이가 따라오고, 그냥 누르면 다음 높이로 간다.
          touch-none이 없으면 끄는 동안 브라우저가 페이지를 같이 스크롤한다. */}
      <button
        type="button"
        aria-label="목록 높이 조절"
        className="-mx-4 flex h-7 shrink-0 touch-none items-center justify-center md:hidden"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={onGrabClick}
      >
        <span aria-hidden className="h-1 w-10 rounded-full bg-outline-variant" />
      </button>
      {/* 주변 | 룰렛 | 나. 룰렛은 탭이 아니라 패널을 여는 버튼이지만 같은
          줄에서 같은 크기로 산다 — 지도 위에 띄웠을 때는 가게를 하나 고르는
          순간 사라져 아무도 다시 찾지 못했다. 탭이 둘뿐이라 role=tablist 대신
          aria-current로 충분하다. */}
      <div className="flex shrink-0 gap-1">
        <button
          aria-current={tab === "near"}
          className={`h-11 flex-1 rounded-lg text-sm font-bold transition-colors md:h-9 ${
            tab === "near"
              ? "bg-primary hover:bg-primary/90 active:bg-primary/80 text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/10"
          }`}
          onClick={() => onTab("near")}
        >
          주변
        </button>
        {/* 색은 비선택 탭과 같게 — 혼자 진하면 셋 중 얘만 눌려 있는 걸로 읽힌다 */}
        <button
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-surface-container text-sm font-bold text-on-surface-variant transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 md:h-9"
          onClick={onRoulette}
        >
          <span aria-hidden>🎯</span>룰렛
        </button>
        <button
          aria-current={tab === "me"}
          className={`h-11 flex-1 rounded-lg text-sm font-bold transition-colors md:h-9 ${
            tab === "me"
              ? "bg-primary hover:bg-primary/90 active:bg-primary/80 text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-on-surface/8 active:bg-on-surface/10"
          }`}
          onClick={() => onTab("me")}
        >
          나
        </button>
      </div>

      {/* 탭 줄은 시트가 아무리 낮아도 남아 있어야 한다 — 스크롤은 이 안쪽만 한다. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      {tab === "near" && (
        <>
          <p className="mt-3 text-sm text-on-surface-variant">
            <span className="font-bold text-on-surface">{originMoved ? "지도에서 찍은 지점" : OFFICE_LABEL}</span> 기준 가까운 순
          </p>
          {/* 지도에서 뭉친 원을 탭해 그 구역만 보고 있는 상태. 왜 갑자기 목록이
              짧아졌는지 말해주지 않으면 필터가 고장 난 걸로 읽힌다. */}
          {clusterCount !== null && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-on-surface-variant">
                지도에서 고른 <span className="font-bold text-on-surface">{clusterCount}곳</span>만 보는 중
              </p>
              <button
                className="h-9 shrink-0 rounded-lg bg-surface-container px-3 text-xs font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
                onClick={onClearCluster}
              >
                전체 보기
              </button>
            </div>
          )}
          {/* 데이터는 회사 5km 안에서만 모았다. 기준점을 밖으로 옮기면 지도가 비는데,
              그건 가게가 없는 게 아니라 우리가 안 가본 곳이다 — 말하지 않으면 거짓말이 된다. */}
          {originMoved && (
            <p className="mt-1 text-xs text-on-surface-variant">
              회사에서 멀어질수록 저희가 모르는 가게가 늘어요. 데이터는 회사 5km 안에서 모았어요.
            </p>
          )}
          {/* 가격 필터를 켜면 후보의 절반 가까이가 조용히 사라진다 — 메뉴 가격이
              등록 안 된 곳이 그만큼 많다. 말없이 빼면 없는 줄 알게 된다. */}
          {unpricedCount > 0 && (
            <p className="mt-1 text-xs text-on-surface-variant">
              가격이 등록 안 된 {unpricedCount}곳은 빠졌어요.
            </p>
          )}
          {shown.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-base font-bold text-on-surface">조건에 맞는 가게가 없어요</p>
              <p className="mt-1 text-sm text-on-surface-variant">반경을 넓히거나 필터를 풀어보세요.</p>
              <div className="mx-auto mt-4 flex max-w-xs flex-col gap-2">
                <button
                  className="grid h-11 place-items-center rounded-lg bg-primary transition-colors hover:bg-primary/90 active:bg-primary/80 text-sm font-bold text-on-primary shadow-xs disabled:opacity-50"
                  onClick={onWiden}
                  disabled={!canWiden}
                >
                  반경 넓히기
                </button>
                <button
                  className="grid h-11 place-items-center rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
                  onClick={onReset}
                >
                  필터 초기화
                </button>
              </div>
            </div>
          ) : (
            <ul className="mt-1">
              {shown.map(({ place, distanceKm }) => {
                // 가격으로 걸렀으면 그 가게를 통과시킨 근거를 보여준다. 통과 근거는
                // 둘 중 가장 싼 값이다 — DB 가격 덕에 통과한 가게가 상한보다 비싼
                // 값을 달고 나오면 필터가 고장 난 것처럼 읽힌다.
                const special = specialPrices.get(place.kakao_place_id);
                const dbMin = dbMinPrices.get(place.kakao_place_id);
                const cheapest = Math.min(
                  ...[dbMin, special?.price].filter((v): v is number => v != null),
                );
                let line = "";
                if (priceFiltered && dbMin !== undefined && dbMin === cheapest) {
                  line = ` · ${formatPrice(String(dbMin))}부터`;
                } else if (priceFiltered && special && special.price === cheapest) {
                  line = ` · 특선 ${special.menuName} ${formatPrice(String(special.price))}`;
                }
                return (
                  <Row
                    key={place.kakao_place_id}
                    lead={formatDistance(distanceKm)}
                    title={place.name}
                    subtitle={place.category + line}
                    onClick={() => onSelect(place)}
                  />
                );
              })}
            </ul>
          )}
          {places.length > shown.length && (
            // 안내문이던 자리다. 지도에는 마커가 다 찍혀 있는데 목록만 잘려서,
            // 왜 안 보이는지는 알려주면서 볼 방법은 안 주는 상태였다.
            <button
              className="my-2 grid h-11 w-full place-items-center rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 md:h-9"
              onClick={() => setRows(n => n + PAGE_ROWS)}
            >
              더 보기 · {shown.length}/{places.length}곳
            </button>
          )}
        </>
      )}

      {tab === "me" && (
        <>
          {/* 거리의 기준점. 지도를 누르면 그 자리로 옮겨간다. */}
          <SectionBar>거리 기준점</SectionBar>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-on-surface">
              {originMoved ? "지도에서 찍은 지점" : OFFICE_LABEL}
            </span>
            {originMoved ? (
              <button
                className="grid h-11 shrink-0 place-items-center rounded-lg bg-surface-container px-3 text-xs font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 md:h-9"
                onClick={onResetOrigin}
              >
                회사 기준으로
              </button>
            ) : (
              <span className="shrink-0 text-xs text-on-surface-variant">지도를 누르면 옮겨져요</span>
            )}
          </div>

          {/* 로그인과 무관한 개인 설정 — 이 브라우저에만 남는다 */}
          <SectionBar>안 먹는 음식</SectionBar>
          <DislikeSettings />

          {!loggedIn ? (
            <Empty>로그인하면 저장한 맛집과 내가 쓴 리뷰가 여기 모여요.</Empty>
          ) : (
            <>
              <SectionBar>저장한 맛집</SectionBar>
              {savedPlaces.length === 0 ? (
                <p className="mt-2 text-sm text-on-surface-variant">
                  아직 없어요. 가게를 열고 ☆ 저장을 눌러보세요.
                </p>
              ) : (
                // 저장 목록은 필터와 반경을 따르지 않는다 — 저장해둔 건 언제나 보여야 한다.
                <ul className="mt-1">
                  {savedPlaces.map(place => (
                    <Row
                      key={place.kakao_place_id}
                      lead={formatDistance(distKm(place))}
                      title={place.name}
                      subtitle={place.category}
                      onClick={() => onSelect(place)}
                    />
                  ))}
                </ul>
              )}

              <SectionBar>내 리뷰</SectionBar>
              {myReviews.length === 0 ? (
                <p className="mt-2 text-sm text-on-surface-variant">아직 쓴 리뷰가 없어요.</p>
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
      </div>
    </aside>
  );
}
