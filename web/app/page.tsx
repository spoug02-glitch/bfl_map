"use client";

import { useEffect, useMemo, useState } from "react";
import EntryNotice from "@/components/EntryNotice";
import FilterBar from "@/components/FilterBar";
import MapView from "@/components/MapView";
import PlacePanel from "@/components/PlacePanel";
import SiteFooter from "@/components/SiteFooter";
import { BlogLink, CATEGORY_GROUPS, Restaurant, normalizeQuery } from "@/lib/constants";

export type SessionUser = { userId: string; nickname: string };

export default function Home() {
  const [all, setAll] = useState<Restaurant[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [maxDist, setMaxDist] = useState(5.0);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [blogLinks, setBlogLinks] = useState<Record<string, BlogLink>>({});
  const [staleLink, setStaleLink] = useState(false);

  useEffect(() => {
    // 공유 링크(?place=<kakao_place_id>)로 들어온 경우 그 가게를 열어준다.
    // 마커 클릭마다 URL을 갱신하지는 않는다 — 공유 버튼만 URL을 만든다.
    // restaurants.json이 도착한 콜백 안에서 처리해 별도의 setState-in-effect를 만들지 않는다.
    fetch("/restaurants.json").then(r => r.json()).then((data: Restaurant[]) => {
      setAll(data);
      const id = new URLSearchParams(window.location.search).get("place");
      if (!id) return;
      const found = data.find(r => r.kakao_place_id === id);
      if (found) setSelected(found);
      else setStaleLink(true);  // 데이터 갱신으로 사라진 가게일 수 있다
    });
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user));
    fetch("/blog_links.json").then(r => r.json()).then(setBlogLinks).catch(() => {});
  }, []);

  const visible = useMemo(() => {
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

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-bold">직장인 맛집지도 🍚</h1>
        {user ? (
          <div className="flex items-center gap-2 text-sm">
            <span>{user.nickname}님</span>
            <button
              className="grid h-11 place-items-center rounded border px-3"
              onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null))}
            >
              로그아웃
            </button>
          </div>
        ) : (
          <a className="grid h-11 place-items-center rounded bg-blue-600 px-3 text-sm font-medium text-white" href="/api/auth/google">
            구글 로그인
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
        <MapView restaurants={visible} maxDist={maxDist} onSelect={setSelected} />
        <SiteFooter />
        {staleLink && (
          <p className="absolute inset-x-0 top-2 z-20 mx-auto w-fit rounded bg-black/80 px-3 py-2 text-sm text-white">
            공유된 가게를 찾지 못했어요. 목록이 갱신되었을 수 있어요.
          </p>
        )}
        {selected && (
          <PlacePanel
            restaurant={selected}
            user={user}
            blogLink={blogLinks[selected.kakao_place_id]}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      <EntryNotice />
    </main>
  );
}
