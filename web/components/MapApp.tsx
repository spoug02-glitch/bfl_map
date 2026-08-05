"use client";

import { useEffect, useMemo, useState } from "react";
import EntryNotice from "@/components/EntryNotice";
import VisitPing from "@/components/VisitPing";
import FilterBar from "@/components/FilterBar";
import MapView from "@/components/MapView";
import NicknameModal from "@/components/NicknameModal";
import PlacePanel from "@/components/PlacePanel";
import SiteFooter from "@/components/SiteFooter";
import PlaceList from "@/components/PlaceList";
import {
  BlogLink,
  CATEGORY_GROUPS,
  CENTER,
  RADIUS_KM,
  Restaurant,
  SessionUser,
  normalizeQuery,
} from "@/lib/constants";
import { haversineKm, type LatLng } from "@/lib/geo";
import { suggestNickname } from "@/lib/nickname";

const OFFICE_LABEL = "창동씨드큐브";

/**
 * `initialPlaceId`는 /place/[id]가 넘겨준다 — 그 경로만이 가게별 OG 태그를 달 수
 * 있어 슬랙·디스코드에서 미리보기 카드가 뜬다. 예전에 뿌려진 /?place=... 링크도
 * 계속 열려야 하므로 쿼리 파라미터 경로를 함께 남겨둔다.
 */
export default function MapApp({ initialPlaceId }: { initialPlaceId?: string }) {
  const [all, setAll] = useState<Restaurant[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [maxDist, setMaxDist] = useState(5.0);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [blogLinks, setBlogLinks] = useState<Record<string, BlogLink>>({});
  const [staleLink, setStaleLink] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  // 거리 계산과 반경 원의 기준점. 지도를 찍으면 옮겨간다.
  const [origin, setOrigin] = useState<LatLng>(CENTER);

  useEffect(() => {
    // 공유 링크로 들어온 경우 그 가게를 열어준다. 마커 클릭마다 URL을 갱신하지는
    // 않는다 — 공유 버튼만 URL을 만든다. restaurants.json이 도착한 콜백 안에서
    // 처리해 별도의 setState-in-effect를 만들지 않는다.
    fetch("/restaurants.json").then(r => r.json()).then((data: Restaurant[]) => {
      setAll(data);
      const id = initialPlaceId ?? new URLSearchParams(window.location.search).get("place");
      if (!id) return;
      const found = data.find(r => r.kakao_place_id === id);
      if (found) setSelected(found);
      else setStaleLink(true);  // 데이터 갱신으로 사라진 가게일 수 있다
    });
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setUser(d.user ?? null))
      .catch(() => setUser(null));
    fetch("/blog_links.json").then(r => r.json()).then(setBlogLinks).catch(() => {});

    // A failed login used to bounce back here with no explanation, so it just
    // looked like nothing happened. The common cause is clicking login twice:
    // each attempt issues a new state token and invalidates the previous one.
    const err = new URLSearchParams(window.location.search).get("login_error");
    if (err) {
      setLoginError(
        err === "state"
          ? "로그인이 만료됐어요. 버튼을 한 번만 누르고 기다려주세요."
          : "로그인에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      // drop the parameter so a refresh does not replay the message
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [initialPlaceId]);

  const atOffice = origin.lat === CENTER.lat && origin.lng === CENTER.lng;

  // 기준점에서의 거리를 붙여 가까운 순으로 정렬한다. 회사에 있을 때는 수집기가
  // 미리 넣어둔 distance_km를 그대로 쓴다 — 같은 공식이지만 5,834번의 계산을 아낀다.
  const ranked = useMemo(() => {
    const cats = group ? new Set(CATEGORY_GROUPS[group]) : null;
    // search the precomputed alias keys, not the raw name — this is what makes
    // "CU" find stores the source data spells "씨유", and "뉴창동" find "뉴(NEW)창동…"
    const q = normalizeQuery(query);
    const rows = [];
    for (const r of all) {
      if (cats && !cats.has(r.category)) continue;
      if (q && !r.search_keys.some(k => k.includes(q))) continue;
      const distanceKm = atOffice ? r.distance_km : haversineKm(origin, { lat: r.lat, lng: r.lng });
      if (distanceKm > maxDist) continue;
      rows.push({ place: r, distanceKm });
    }
    rows.sort((a, b) => a.distanceKm - b.distanceKm);
    return rows;
  }, [all, group, query, maxDist, origin, atOffice]);

  const visible = useMemo(() => ranked.map(x => x.place), [ranked]);

  const resetFilters = () => { setGroup(null); setQuery(""); setMaxDist(RADIUS_KM); };
  const widenRadius = () => setMaxDist(Math.min(5, Math.round((maxDist + 1) * 10) / 10));

  return (
    <main className="flex h-dvh flex-col bg-surface-page">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-surface-page/80 px-4 shadow-xs backdrop-blur-md md:h-12">
        <h1 className="text-lg font-bold tracking-tight text-text-primary">직장인 맛집지도</h1>
        {user?.nickname ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              className="grid h-11 place-items-center rounded-lg px-2 text-text-primary md:h-9"
              onClick={() => setEditingNickname(true)}
            >
              {user.nickname}님
            </button>
            <button
              className="grid h-11 place-items-center rounded-lg border border-border px-3 text-text-primary md:h-9"
              onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null))}
            >
              로그아웃
            </button>
          </div>
        ) : user ? (
          // 로그인은 했지만 닉네임이 없는 상태: NicknameModal이 화면을 덮고 있어
          // 나갈 방법이 없다. DB 장애로 저장이 계속 실패하면 그대로 갇히므로,
          // 지도만이라도 보러 갈 수 있게 로그아웃 출구를 열어둔다.
          <button
            className="grid h-11 place-items-center rounded-lg border border-border px-3 text-sm text-text-primary md:h-9"
            onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null))}
          >
            로그아웃
          </button>
        ) : (
          // 로그인 수단은 카카오 하나뿐이다. 구글도 열어두면 한 사람이 계정을
          // 두 개 갖게 되고, 같은 가게에 리뷰를 두 번 남겨 평점을 밀 수 있다.
          <a
            className="grid h-11 place-items-center rounded-lg bg-ink px-4 text-sm font-bold text-white shadow-xs md:h-9"
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
        count={visible.length}
      />
      <div className="relative flex-1">
        <MapView
          restaurants={visible}
          maxDist={maxDist}
          origin={origin}
          onSelect={setSelected}
          onPickOrigin={setOrigin}
        />
        {!atOffice && (
          <button
            className="absolute left-3 top-3 z-20 grid h-11 place-items-center rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-primary shadow-lg"
            onClick={() => setOrigin(CENTER)}
          >
            ↺ {OFFICE_LABEL} 기준으로
          </button>
        )}
        <SiteFooter />
        {staleLink && (
          <div className="absolute inset-x-0 top-3 z-20 mx-auto w-fit max-w-[min(90vw,22rem)] rounded-xl border border-border bg-surface px-4 py-3 text-center shadow-lg">
            <p className="font-bold text-text-primary">공유된 가게를 찾지 못했어요</p>
            <p className="mt-1 text-sm text-text-muted">가게 정보가 갱신되었거나 잘못된 링크일 수 있어요.</p>
          </div>
        )}
        {loginError && (
          <div
            role="alert"
            className="absolute inset-x-0 top-3 z-20 mx-auto w-fit max-w-[min(90vw,22rem)] rounded-xl border border-border bg-surface px-4 py-3 text-center shadow-lg"
          >
            <p className="font-bold text-text-primary">로그인하지 못했어요</p>
            <p className="mt-1 text-sm text-text-muted">{loginError}</p>
            <button
              className="mt-3 grid h-11 w-full place-items-center rounded-lg bg-ink text-sm font-bold text-white"
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
            onClose={() => setSelected(null)}
          />
        ) : all.length > 0 && (
          <PlaceList
            places={ranked}
            originLabel={atOffice ? OFFICE_LABEL : "선택한 지점"}
            onSelect={setSelected}
            onWiden={widenRadius}
            onReset={resetFilters}
            canWiden={maxDist < RADIUS_KM}
          />
        )}
        {user && user.nickname === null && (
          <NicknameModal
            mode="create"
            initial={suggestNickname()}
            onSaved={n => setUser({ ...user, nickname: n })}
            onClose={() => {}}
          />
        )}
        {user?.nickname && editingNickname && (
          <NicknameModal
            mode="edit"
            initial={user.nickname}
            onSaved={n => { setUser({ ...user, nickname: n }); setEditingNickname(false); }}
            onClose={() => setEditingNickname(false)}
          />
        )}
      </div>
      <EntryNotice />
      <VisitPing />
    </main>
  );
}
