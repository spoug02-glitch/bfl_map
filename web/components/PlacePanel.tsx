"use client";

import { BlogLink, Restaurant, formatPrice, isConvenienceStore } from "@/lib/constants";
import ReviewSection from "@/components/ReviewSection";
import SaveButton from "@/components/SaveButton";
import ShareButton from "@/components/ShareButton";
import type { SessionUser } from "@/lib/constants";

type Props = {
  restaurant: Restaurant;
  user: SessionUser | null;
  blogLink?: BlogLink;
  saved: boolean;
  onToggleSaved: (placeId: string, saved: boolean) => void;
  onClose: () => void;
};

// 모바일(<768px)에서는 하단 바텀시트, md 이상에서는 우측 사이드 패널.
// fixed + inset-x-0 bottom-0 로 뷰포트에 붙이고, md부터 absolute 우측 전체높이로 전환한다.
export default function PlacePanel({
  restaurant: r, user, blogLink, saved, onToggleSaved, onClose,
}: Props) {
  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-10 max-h-[75dvh] w-full overflow-y-auto
        rounded-t-2xl border-t border-border-subtle bg-surface p-4 shadow-lg
        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">{r.name}</h2>
          <p className="mt-1 text-base text-text-muted">{r.category} · {r.distance_km}km</p>
        </div>
        <button
          aria-label="닫기"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl text-text-primary"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="mt-4 space-y-2 rounded border border-border-subtle bg-surface-muted p-4">
        <p className="text-base text-text-primary">📍 {r.address}</p>
        {r.phone && <p className="text-base text-text-primary">📞 {r.phone}</p>}
        <a className="flex h-11 items-center text-base text-accent underline" href={r.kakao_url} target="_blank" rel="noreferrer">
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
          <h3 className="mt-6 border-b border-border-subtle pb-2 text-xl font-bold text-text-primary">메뉴</h3>
          {r.menus.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">메뉴 정보 없음 — 카카오맵 링크에서 확인</p>
          ) : (
            <ul className="mt-1">
              {r.menus.map(m => (
                <li key={m.name} className="flex items-center justify-between border-b border-border-subtle/50 py-3 text-base last:border-b-0">
                  <span className="text-text-primary">{m.name}</span>
                  {/* 가격 미공개(-1)나 빈 값이면 칸을 비운다 — 카카오가 -1을 주는데
                      그대로 찍으면 "-1원"이 된다. */}
                  <span className="text-price">{formatPrice(m.price) ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* 만든 이 블로그 후기: 사용자 리뷰 위에, 출처가 드러나는 별도 카드로 노출한다.
          지도 마커 순서·검색 순위에는 영향을 주지 않는다(랭킹 조작 금지). */}
      {blogLink && (
        <a
          className="mt-6 block rounded-lg bg-surface-muted p-4"
          href={blogLink.url}
          target="_blank"
          rel="noreferrer"
        >
          <span className="text-xs font-medium text-text-muted">✍️ 만든 이 블로그 후기</span>
          <p className="mt-1 font-bold text-accent underline">{blogLink.title}</p>
        </a>
      )}

      <ReviewSection placeId={r.kakao_place_id} user={user} />
    </aside>
  );
}
