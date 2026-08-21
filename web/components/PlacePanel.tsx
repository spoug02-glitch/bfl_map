"use client";

import { useEffect, useState } from "react";
import { BlogLink, Restaurant, formatPrice, isConvenienceStore } from "@/lib/constants";
import { track, type EntryContext } from "@/lib/gtag";
import { sourceLabel } from "@/lib/menu-source";
import ReviewSection from "@/components/ReviewSection";
import SaveButton from "@/components/SaveButton";
import SpecialSection from "@/components/SpecialSection";
import ShareButton from "@/components/ShareButton";
import type { SessionUser } from "@/lib/constants";
import type { MenuSourceType, MenuStatus } from "@/lib/menu-source";

type Props = {
  restaurant: Restaurant;
  /** 이 가게 상세에 어떻게 도달했는지. 공유 링크로 온 사람은 행동이 달라 통제해야 한다. */
  entryContext: EntryContext;
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
  restaurant: r, entryContext, user, blogLink, saved, onToggleSaved, onClose,
}: Props) {
  const [dbMenus, setDbMenus] = useState<DbMenuRow[]>([]);

  useEffect(() => {
    // 가게를 빠르게 갈아타면 앞선 요청이 뒤에 도착해 A의 메뉴가 B 패널에 남는다.
    // 응답을 버리는 플래그로 막는다 — 여기서 setDbMenus([])로 먼저 비우면
    // react-hooks/set-state-in-effect에 걸린다.
    let live = true;
    fetch(`/api/menu-items?placeId=${r.kakao_place_id}`)
      .then(res => res.json())
      .then(d => {
        if (!live) return;
        const items: DbMenuRow[] = d.items ?? [];
        setDbMenus(items);
        // place_view 를 패널이 열릴 때가 아니라 여기서 쏜다. has_menu 는 이 응답이
        // 와야 알 수 있는 값이라, 열자마자 쏘면 매번 false 로 나가거나 이벤트를 두 번
        // 쏴야 한다. 대가는 응답 전에 닫으면 집계되지 않는다는 것 — 0.1초짜리는
        // 어차피 조회가 아니다. live 플래그를 같이 타므로 가게를 빨리 갈아타도
        // 늦게 온 A의 응답이 B의 조회로 기록되지 않는다.
        track({
          name: "place_view",
          place_id: r.kakao_place_id,
          place_category: r.category,
          entry_context: entryContext,
          place_kind: isConvenienceStore(r.category) ? "convenience" : "meal",
          has_menu: items.length > 0,
          menu_count: items.length,
        });
      })
      // 실패했을 때는 쏘지 않는다. has_menu=false 로 보내면 네트워크 장애가
      // "메뉴 없는 가게"로 집계돼 비교 자체를 오염시킨다.
      .catch(() => { if (live) setDbMenus([]); });
    return () => { live = false; };
    // entryContext 는 가게가 바뀔 때 같이 정해진다. 여기 넣으면 같은 가게를 목록에서
    // 다시 여는 등으로 값만 바뀌었을 때 조회가 중복 기록된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.kakao_place_id, r.category]);

  // 출처와 확인일은 줄마다 붙이지 않고 목록 아래 한 줄로 모은다. 메뉴 하나하나에
  // 배지와 날짜를 달면 정작 궁금한 메뉴명과 가격이 묻힌다.
  const sources = [...new Set(dbMenus.map(m => sourceLabel(m.source_type)))];
  const latestVerified = dbMenus
    .map(m => m.verified_at)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1);
  const sourceNote = sources.length
    ? sources.join(" · ") + (latestVerified
        ? ` · ${new Date(latestVerified).toLocaleDateString("ko-KR")} 확인`
        : "")
    : "";

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
        {/* 핵심 전환이다 — 길찾기로 넘어갔다는 건 실제로 가겠다는 뜻이다.
            나가는 링크라 결과를 알 수 없어 클릭 시점에 센다. */}
        <a
          className="flex h-11 items-center text-base text-primary underline"
          href={r.kakao_url}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            track({ name: "place_map_open", place_id: r.kakao_place_id, place_category: r.category })
          }
        >
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
          {dbMenus.length === 0 ? (
            <p className="mt-2 text-sm text-on-surface-variant">메뉴 정보 없음 — 카카오맵 링크에서 확인</p>
          ) : (
            <>
              <ul className="mt-1">
                {dbMenus.map((m, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-outline-variant/50 py-3 text-base last:border-b-0">
                    <span className="min-w-0 flex-1 truncate text-on-surface">
                      {m.menu_name}
                      {/* 확정 전 제보임을 알리는 건 줄에 남긴다 — 이건 값의 신뢰도라
                          아래로 모으면 어느 메뉴 얘기인지 알 수 없다. */}
                      {m.status === "pending" && (
                        <span className="ml-1 text-[11px] text-on-surface-variant">미확인</span>
                      )}
                    </span>
                    <span className="shrink-0 text-price">{formatPrice(m.price !== null ? String(m.price) : "") ?? ""}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-on-surface-variant">{sourceNote}</p>
            </>
          )}
          {/* 카카오 메뉴에는 점심특선이 거의 안 올라온다 — 그 빈칸은 먹어본
              사람이 채운다. 편의점 분기 안에 있는 이유: 특선은 밥집의 것이다. */}
          <SpecialSection placeId={r.kakao_place_id} loggedIn={user !== null} hasMenus={dbMenus.length > 0} />
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
          // 나가는 링크라 결과를 알 수 없다 — 클릭 시점에 쏜다.
          onClick={() =>
            track({ name: "blog_review_click", place_id: r.kakao_place_id, place_category: r.category })
          }
        >
          <span className="text-xs font-medium text-on-surface-variant">✍️ 만든 이 블로그 후기</span>
          <p className="mt-1 font-bold text-primary underline">{blogLink.title}</p>
        </a>
      )}

      <ReviewSection placeId={r.kakao_place_id} placeCategory={r.category} user={user} />
    </aside>
  );
}
