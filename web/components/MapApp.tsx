"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EntryNotice from "@/components/EntryNotice";
import VisitPing from "@/components/VisitPing";
import FilterBar from "@/components/FilterBar";
import MapView, { type MapApi } from "@/components/MapView";
import NicknameModal from "@/components/NicknameModal";
import PlacePanel from "@/components/PlacePanel";
import SiteFooter from "@/components/SiteFooter";
import RoulettePanel from "@/components/RoulettePanel";
import PlaceList, { type ListTab, type MyReview } from "@/components/PlaceList";
import {
  BlogLink,
  CATEGORY_GROUPS,
  DEFAULT_VIEW_RADIUS_KM,
  RADIUS_KM,
  Restaurant,
  SessionUser,
  SpecialPrice,
  effectiveMinPrice,
  normalizeQuery,
} from "@/lib/constants";
import { suggestNickname } from "@/lib/nickname";
import { REJOIN_BLOCK_DAYS } from "@/lib/rejoin";

/**
 * `initialPlaceId`는 /place/[id]가 넘겨준다 — 그 경로만이 가게별 OG 태그를 달 수
 * 있어 슬랙·디스코드에서 미리보기 카드가 뜬다. 예전에 뿌려진 /?place=... 링크도
 * 계속 열려야 하므로 쿼리 파라미터 경로를 함께 남겨둔다.
 */
export default function MapApp({ initialPlaceId }: { initialPlaceId?: string }) {
  const [all, setAll] = useState<Restaurant[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [maxDist, setMaxDist] = useState(DEFAULT_VIEW_RADIUS_KM);
  // null이면 가격으로 거르지 않는다.
  const [priceLimit, setPriceLimit] = useState<number | null>(null);
  // 가게별 최저가 점심특선 제보. 가격 필터가 카카오 메뉴와 함께 본다.
  const [specialPrices, setSpecialPrices] = useState<Map<string, SpecialPrice>>(new Map());
  // null = 아직 아무도 안 정함(화면 폭이 정한다). 의미는 FilterBar 주석 참조.
  const [barOpen, setBarOpen] = useState<boolean | null>(null);
  const mapApi = useRef<MapApi | null>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [blogLinks, setBlogLinks] = useState<Record<string, BlogLink>>({});
  const [staleLink, setStaleLink] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [tab, setTab] = useState<ListTab>("near");
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);

  useEffect(() => {
    // 공유 링크로 들어온 경우 그 가게를 열어준다. 마커 클릭마다 URL을 갱신하지는
    // 않는다 — 공유 버튼만 URL을 만든다. restaurants.json이 도착한 콜백 안에서
    // 처리해 별도의 setState-in-effect를 만들지 않는다.
    fetch("/restaurants.json").then(r => r.json()).then((data: Restaurant[]) => {
      setAll(data);
      const id = initialPlaceId ?? new URLSearchParams(window.location.search).get("place");
      if (!id) return;
      const found = data.find(r => r.kakao_place_id === id);
      if (found) {
        setSelected(found);
        // 공유된 가게가 기본 100m 밖이면 반경을 그 가게까지 넓힌다. 안 그러면
        // 상세를 닫는 순간 지도에도 목록에도 없는 가게가 된다. 0.1 단위로 올려
        // 슬라이더 눈금과 어긋나지 않게 한다.
        setMaxDist(d => Math.max(d, Math.ceil(found.distance_km * 10) / 10));
      } else {
        setStaleLink(true);  // 데이터 갱신으로 사라진 가게일 수 있다
      }
    });
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setUser(d.user ?? null))
      .catch(() => setUser(null));
    fetch("/blog_links.json").then(r => r.json()).then(setBlogLinks).catch(() => {});
    fetch("/api/specials")
      .then(r => r.json())
      .then(d =>
        setSpecialPrices(
          new Map(
            (d.specials ?? []).map((s: { place_id: string; menu_name: string; price: number }) => [
              s.place_id,
              { menuName: s.menu_name, price: s.price },
            ]),
          ),
        ),
      )
      .catch(() => {});

    // A failed login used to bounce back here with no explanation, so it just
    // looked like nothing happened. The common cause is clicking login twice:
    // each attempt issues a new state token and invalidates the previous one.
    const err = new URLSearchParams(window.location.search).get("login_error");
    if (err) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoginError(
        err === "state"
          ? "로그인이 만료됐어요. 버튼을 한 번만 누르고 기다려주세요."
          : err === "rejoin"
            // 탈퇴한 계정이 곧바로 돌아온 경우. 왜 막혔는지 모르면 고장으로 읽힌다.
            ? `탈퇴 후 ${REJOIN_BLOCK_DAYS}일이 지나야 다시 가입할 수 있어요. 그동안에도 지도와 가게 정보는 그대로 보실 수 있어요.`
            : "로그인에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      // drop the parameter so a refresh does not replay the message
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [initialPlaceId]);

  // 거리는 수집기가 회사 기준으로 미리 계산해 넣어둔 값을 그대로 쓴다.
  // 가격은 여기서 거르지 않는다 — 가격 때문에 몇 곳이 빠졌는지 세려면 그 직전
  // 상태가 필요하다.
  const matched = useMemo(() => {
    const cats = group ? new Set(CATEGORY_GROUPS[group]) : null;
    // search the precomputed alias keys, not the raw name — this is what makes
    // "CU" find stores the source data spells "씨유", and "뉴창동" find "뉴(NEW)창동…"
    const q = normalizeQuery(query);
    return all.filter(r =>
      r.distance_km <= maxDist &&
      (!cats || cats.has(r.category)) &&
      (!q || r.search_keys.some(k => k.includes(q))),
    );
  }, [all, group, query, maxDist]);

  // 안 먹는 음식은 지도와 목록을 건드리지 않는다 — 그건 그 동네에 뭐가 있는지를
  // 보여주는 화면이지 내 취향을 반영하는 화면이 아니다. 거르는 건 룰렛 랜덤뿐이고,
  // 그 판단은 후보를 뽑는 RoulettePanel이 직접 한다.

  // 씨드큐브 500m 안 196곳 중 88곳은 메뉴 가격이 아예 없다. 필터를 켜면 그만큼이
  // 조용히 사라지므로 몇 곳인지 세어 목록이 알리게 한다.
  const unpricedCount = useMemo(
    () =>
      priceLimit !== null
        ? matched.filter(r => effectiveMinPrice(r.menus, specialPrices.get(r.kakao_place_id)) === null).length
        : 0,
    [matched, priceLimit, specialPrices],
  );

  const ranked = useMemo(() => {
    const kept = priceLimit !== null
      ? matched.filter(r => {
          const min = effectiveMinPrice(r.menus, specialPrices.get(r.kakao_place_id));
          return min !== null && min <= priceLimit;
        })
      : matched;
    return kept
      .map(place => ({ place, distanceKm: place.distance_km }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [matched, priceLimit, specialPrices]);

  const visible = useMemo(() => ranked.map(x => x.place), [ranked]);

  const placeById = useMemo(
    () => new Map(all.map(r => [r.kakao_place_id, r])),
    [all],
  );

  // 저장 목록은 필터·반경과 무관하게 저장한 순서 그대로 보여준다.
  // 로그아웃하면 상태를 비우는 대신 여기서 거른다 — effect 안에서 동기적으로
  // setState를 부르면 렌더가 연쇄로 도는 패턴이 된다.
  const savedPlaces = useMemo(
    () =>
      user
        ? [...savedIds].map(id => placeById.get(id)).filter((r): r is Restaurant => r !== undefined)
        : [],
    [user, savedIds, placeById],
  );

  // 로그인 상태가 정해진 뒤에만 부른다 — 비로그인 상태에서 부르면 401만 쌓인다.
  const loadMine = useCallback(() => {
    if (!user) return;
    fetch("/api/saved").then(r => r.ok ? r.json() : { placeIds: [] })
      .then(d => setSavedIds(new Set(d.placeIds ?? [])))
      .catch(() => {});
    fetch("/api/reviews/mine").then(r => r.ok ? r.json() : { reviews: [] })
      .then(d => setMyReviews(d.reviews ?? []))
      .catch(() => {});
  }, [user]);

  useEffect(loadMine, [loadMine]);

  const toggleSaved = useCallback((placeId: string, saved: boolean) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (saved) next.add(placeId); else next.delete(placeId);
      return next;
    });
  }, []);

  const logout = () => fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null));

  const resetFilters = () => {
    setGroup(null); setQuery(""); setMaxDist(RADIUS_KM); setPriceLimit(null);
  };
  const widenRadius = () => setMaxDist(Math.min(5, Math.round((maxDist + 1) * 10) / 10));

  return (
    <main className="flex h-dvh flex-col bg-surface">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface/80 px-4 shadow-xs backdrop-blur-md md:h-12">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-on-surface">
          {/* 로고 파일을 쓰지 않고 인라인으로 둔다 — 헤더는 첫 화면에 반드시 뜨는
              자리라 요청을 하나 더 태울 이유가 없다. */}
          <svg viewBox="0 0 64 64" width="22" height="22" aria-hidden className="shrink-0">
            <path d="M13 24h38c0 11-8.5 20-19 20s-19-9-19-20z" fill="currentColor" />
            <path d="M23 44h18l-9 13z" fill="currentColor" />
            <g stroke="#fe6b00" strokeWidth="3.2" strokeLinecap="round" fill="none">
              <path d="M26 17c0-3 3-3 3-6" />
              <path d="M35 17c0-3 3-3 3-6" />
            </g>
          </svg>
          직장인 맛창고
        </h1>
        {user?.nickname ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              className="grid h-11 place-items-center rounded-lg px-2 text-on-surface md:h-9"
              onClick={() => setEditingNickname(true)}
            >
              {user.nickname}님
            </button>
            <button
              className="grid h-11 place-items-center rounded-lg border border-outline px-3 text-on-surface md:h-9"
              onClick={logout}
            >
              로그아웃
            </button>
          </div>
        ) : user ? (
          // 로그인은 했지만 닉네임이 없는 상태: NicknameModal이 화면을 덮고 있어
          // 나갈 방법이 없다. DB 장애로 저장이 계속 실패하면 그대로 갇히므로,
          // 지도만이라도 보러 갈 수 있게 로그아웃 출구를 열어둔다.
          // 같은 출구가 모달 안에도 있다 — 이 버튼은 마우스로만 닿는다.
          <button
            className="grid h-11 place-items-center rounded-lg border border-outline px-3 text-sm text-on-surface md:h-9"
            onClick={logout}
          >
            로그아웃
          </button>
        ) : (
          // 로그인 수단은 카카오 하나뿐이다. 구글도 열어두면 한 사람이 계정을
          // 두 개 갖게 되고, 같은 가게에 리뷰를 두 번 남겨 평점을 밀 수 있다.
          <a
            className="grid h-11 place-items-center rounded-lg bg-primary px-4 text-sm font-bold text-on-primary shadow-xs md:h-9"
            href="/api/auth/kakao"
          >
            카카오 로그인
          </a>
        )}
      </header>
      <FilterBar
        group={group} onGroup={setGroup}
        query={query} onQuery={setQuery}
        maxDist={maxDist} onMaxDist={setMaxDist}
        priceLimit={priceLimit} onPriceLimit={setPriceLimit}
        open={barOpen} onOpenChange={setBarOpen}
        count={visible.length}
      />
      <div className="relative flex-1">
        {/* 지도에 손을 대면 필터바를 접는다 — 펼친 바는 화면의 40%를 먹는데,
            지도를 만지기 시작했다는 건 이제 지도를 보겠다는 뜻이다. capture라
            카카오 지도의 팬·줌은 그대로 이어지고, 목록 시트는 형제 요소라 안
            걸린다. 화면 폭이 아니라 입력 종류로 가른다 — 폭이 데스크톱처럼
            보고되는 폰(폴드류·인앱 브라우저)에서도 터치는 터치다. 마우스는
            바가 상주하는 데스크톱이니 놔둔다. */}
        <div
          className="h-full w-full"
          onPointerDownCapture={e => {
            if (e.pointerType !== "mouse") setBarOpen(false);
          }}
        >
          <MapView restaurants={visible} maxDist={maxDist} onSelect={setSelected} apiRef={mapApi} />
        </div>
        {/* 카카오맵의 현위치 버튼 자리에 회사가 있다. 마커도 같은 일을 하지만
            전국 크기로 빼면 마커는 찾을 수 없다 — 버튼은 어디서든 그 자리다. */}
        {!selected && !rouletteOpen && (
          <button
            className="absolute bottom-[36dvh] right-3 z-20 flex h-11 items-center gap-1.5 rounded-full
              border border-outline-variant bg-surface-container-lowest px-4 text-sm font-bold text-on-surface shadow-lg
              md:bottom-4 md:right-[calc(24rem+0.75rem)]"
            onClick={() => mapApi.current?.recenter()}
          >
            <span aria-hidden>🏢</span>회사
          </button>
        )}
        <SiteFooter overlay />
        {staleLink && (
          <div className="absolute inset-x-0 top-3 z-20 mx-auto w-fit max-w-[min(90vw,22rem)] rounded-xl border border-outline bg-surface-container-lowest px-4 py-3 text-center shadow-lg">
            <p className="font-bold text-on-surface">공유된 가게를 찾지 못했어요</p>
            <p className="mt-1 text-sm text-on-surface-variant">가게 정보가 갱신되었거나 잘못된 링크일 수 있어요.</p>
          </div>
        )}
        {loginError && (
          <div
            role="alert"
            className="absolute inset-x-0 top-3 z-20 mx-auto w-fit max-w-[min(90vw,22rem)] rounded-xl border border-outline bg-surface-container-lowest px-4 py-3 text-center shadow-lg"
          >
            <p className="font-bold text-on-surface">로그인하지 못했어요</p>
            <p className="mt-1 text-sm text-on-surface-variant">{loginError}</p>
            <button
              className="mt-3 grid h-11 w-full place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary"
              onClick={() => setLoginError(null)}
            >
              확인
            </button>
          </div>
        )}
        {/* 같은 자리를 나눠 쓴다: 고른 가게가 있으면 상세, 없으면 가까운 순 목록.
            리뷰가 아직 없어 평점으로 고를 수가 없으니, 목록의 정렬 기준은 거리다. */}
        {selected ? (
          <PlacePanel
            restaurant={selected}
            user={user}
            blogLink={blogLinks[selected.kakao_place_id]}
            saved={savedIds.has(selected.kakao_place_id)}
            onToggleSaved={toggleSaved}
            onClose={() => { setSelected(null); loadMine(); }}
          />
        ) : all.length > 0 && (
          <PlaceList
            tab={tab}
            onTab={setTab}
            places={ranked}
            savedPlaces={savedPlaces}
            myReviews={user ? myReviews : []}
            placeById={placeById}
            loggedIn={user !== null}
            priceFiltered={priceLimit !== null}
            specialPrices={specialPrices}
            unpricedCount={unpricedCount}
            onSelect={setSelected}
            onWiden={widenRadius}
            onReset={resetFilters}
            onRoulette={() => setRouletteOpen(true)}
            canWiden={maxDist < RADIUS_KM}
          />
        )}
        {rouletteOpen && (
          <RoulettePanel
            pool={visible}
            savedPlaces={savedPlaces}
            specialPrices={specialPrices}
            onClose={() => setRouletteOpen(false)}
          />
        )}
        {user && user.nickname === null && (
          <NicknameModal
            mode="create"
            initial={suggestNickname()}
            onSaved={n => setUser({ ...user, nickname: n })}
            onClose={() => {}}
            onLogout={logout}
          />
        )}
        {user?.nickname && editingNickname && (
          <NicknameModal
            mode="edit"
            initial={user.nickname}
            suspendedUntil={user.suspendedUntil}
            onSaved={n => { setUser({ ...user, nickname: n }); setEditingNickname(false); }}
            onClose={() => setEditingNickname(false)}
            onWithdrawn={() => {
              // 지워진 계정의 흔적을 화면에 남기지 않는다.
              setEditingNickname(false);
              setUser(null);
              setSavedIds(new Set());
              setMyReviews([]);
              setSelected(null);
            }}
          />
        )}
      </div>
      <EntryNotice />
      <VisitPing />
    </main>
  );
}
