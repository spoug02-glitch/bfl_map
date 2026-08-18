"use client";

import { useEffect, useState } from "react";
import { BlogLink, Restaurant, formatPrice, isConvenienceStore } from "@/lib/constants";
import { sourceLabel } from "@/lib/menu-source";
import ReviewSection from "@/components/ReviewSection";
import SaveButton from "@/components/SaveButton";
import SpecialSection from "@/components/SpecialSection";
import ShareButton from "@/components/ShareButton";
import type { SessionUser } from "@/lib/constants";
import type { MenuSourceType, MenuStatus } from "@/lib/menu-source";

type Props = {
  restaurant: Restaurant;
  user: SessionUser | null;
  blogLink?: BlogLink;
  saved: boolean;
  onToggleSaved: (placeId: string, saved: boolean) => void;
  onClose: () => void;
};

type DbMenuRow = {
  menu_name: string;
  price: number | null;
  source_type: MenuSourceType;
  status: MenuStatus;
  verified_at: string | null;
  collected_at: string;
};

// 모바일(<768px)에서는 하단 바텀시트, md 이상에서는 우측 사이드 패널.
// fixed + inset-x-0 bottom-0 로 뷰포트에 붙이고, md부터 absolute 우측 전체높이로 전환한다.
export default function PlacePanel({
  restaurant: r, user, blogLink, saved, onToggleSaved, onClose,
}: Props) {
  const [dbMenus, setDbMenus] = useState<DbMenuRow[]>([]);

  useEffect(() => {
    // 가게를 빠르게 갈아타면 앞선 요청이 뒤에 도착해 A의 메뉴가 B 패널에 남는다.
    // 응답을 버리는 플래그로 막는다 — 여기서 setDbMenus([])로 먼저 비우면
    // react-hooks/set-state-in-effect에 걸린다.
    let live = true;
    fetch(`/api/menu-items?placeId=${r.kakao_place_id}`)
      .then(res => res.json())
      .then(d => { if (live) setDbMenus(d.items ?? []); })
      .catch(() => { if (live) setDbMenus([]); });
    return () => { live = false; };
  }, [r.kakao_place_id]);

  // 공공데이터와 카카오가 같은 메뉴를 들고 있으면 출처가 있는 쪽만 남긴다.
  // 실측(2026-08-17) 공공데이터 104건 중 41건이 카카오에도 있어, 안 거르면
  // 39%가 화면에 두 번 뜬다.
  const norm = (s: string) => s.replace(/[\s()]/g, "");
  const dbNames = new Set(dbMenus.map(m => norm(m.menu_name)));
  const crawledMenus = r.menus.filter(m => !dbNames.has(norm(m.name)));
  const hasAnyMenu = dbMenus.length > 0 || r.menus.length > 0;

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-10 max-h-[75dvh] w-full overflow-y-auto
        rounded-t-2xl border-t border-outline-variant bg-surface-container-low p-4 shadow-elevation-3
        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">{r.name}</h2>
          <p className="mt-1 text-base text-on-surface-variant">{r.category} · {r.distance_km}km</p>
        </div>
        <button
          aria-label="닫기"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl text-on-surface"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="mt-4 space-y-2 rounded border border-outline-variant bg-surface-container p-4">
        <p className="text-base text-on-surface">📍 {r.address}</p>
        {r.phone && <p className="text-base text-on-surface">📞 {r.phone}</p>}
        <a className="flex h-11 items-center text-base text-primary underline" href={r.kakao_url} target="_blank" rel="noreferrer">
          카카오맵에서 보기 ↗
        </a>
      </div>

      <SaveButton
        placeId={r.kakao_place_id}
        saved={saved}
        loggedIn={user !== null}
        onChange={onToggleSaved}
      />
      <ShareButton restaurant={r} />

      {/* 편의점 결제 주의는 진입 토스트(EntryNotice)와 푸터가 담당한다.
          가게를 고를 때마다 같은 경고를 반복 노출하지 않는다. */}

      {/* 편의점은 메뉴 개념이 없어 수집 단계에서 아예 조회하지 않는다 */}
      {!isConvenienceStore(r.category) && (
        <>
          <h3 className="mt-6 border-b border-outline-variant pb-2 text-xl font-bold text-on-surface">메뉴</h3>
          {!hasAnyMenu ? (
            <p className="mt-2 text-sm text-on-surface-variant">메뉴 정보 없음 — 카카오맵 링크에서 확인</p>
          ) : (
            <>
              {/* 출처가 분명한 쪽을 위에 둔다 — DB 메뉴가 먼저, 카카오 메뉴는 그다음. */}
              {dbMenus.length > 0 && (
                <ul className="mt-1">
                  {dbMenus.map((m, i) => (
                    <li key={i} className="border-b border-outline-variant/50 py-3 text-base last:border-b-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 text-on-surface">
                          <span className="rounded bg-tertiary-container px-1 py-0.5 text-[10px] font-bold text-on-tertiary-container">
                            {sourceLabel(m.source_type)}
                            {m.status === "pending" && " · 미확인"}
                          </span>{" "}
                          {m.menu_name}
                        </span>
                        <span className="shrink-0 text-price">{formatPrice(m.price !== null ? String(m.price) : "") ?? ""}</span>
                      </div>
                      {/* 확인일이 없으면 아무것도 적지 않는다 — 빈 자리를 만들지 않는다. */}
                      {m.verified_at && (
                        <p className="mt-1 text-[11px] text-on-surface-variant">
                          {new Date(m.verified_at).toLocaleDateString("ko-KR")} 확인
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {crawledMenus.length > 0 && (
                <>
                  <p className="mt-2 text-[11px] text-on-surface-variant">카카오맵에서 가져온 정보예요.</p>
                  <ul className="mt-1">
                    {crawledMenus.map(m => (
                      <li key={m.name} className="flex items-center justify-between border-b border-outline-variant/50 py-3 text-base last:border-b-0">
                        <span className="text-on-surface">{m.name}</span>
                        {/* 가격 미공개(-1)나 빈 값이면 칸을 비운다 — 카카오가 -1을 주는데
                            그대로 찍으면 "-1원"이 된다. */}
                        <span className="text-price">{formatPrice(m.price) ?? ""}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          {/* 카카오 메뉴에는 점심특선이 거의 안 올라온다 — 그 빈칸은 먹어본
              사람이 채운다. 편의점 분기 안에 있는 이유: 특선은 밥집의 것이다. */}
          <SpecialSection placeId={r.kakao_place_id} loggedIn={user !== null} hasMenus={hasAnyMenu} />
        </>
      )}

      {/* 만든 이 블로그 후기: 사용자 리뷰 위에, 출처가 드러나는 별도 카드로 노출한다.
          지도 마커 순서·검색 순위에는 영향을 주지 않는다(랭킹 조작 금지). */}
      {blogLink && (
        <a
          className="mt-6 block rounded-lg bg-surface-container p-4"
          href={blogLink.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className="text-xs font-medium text-on-surface-variant">✍️ 만든 이 블로그 후기</span>
          <p className="mt-1 font-bold text-primary underline">{blogLink.title}</p>
        </a>
      )}

      <ReviewSection placeId={r.kakao_place_id} user={user} />
    </aside>
  );
}
