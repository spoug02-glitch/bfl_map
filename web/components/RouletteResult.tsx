"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MenuLines from "@/components/MenuLines";
import RouletteWheel from "@/components/RouletteWheel";
import { Restaurant, SpecialPrice } from "@/lib/constants";
import { sharePath } from "@/lib/share-copy";
import type { LadderDraw } from "@/lib/ladder-link";

/**
 * 공유 링크로 들어온 사람이 보는 화면. 링크에 담긴 후보와 당첨으로 같은 원판을
 * 다시 그리고, 눈앞에서 한 번 돌려 보여준다.
 *
 * 경로가 /ladder인 이유는 사다리 시절 링크가 이미 나가 있어서다 — 그 링크들이
 * 계속 열려야 하므로 주소와 토큰 형식은 그대로 두고 화면만 바뀌었다.
 */
export default function RouletteResult({ draw }: { draw: LadderDraw | null }) {
  const [names, setNames] = useState<Map<string, Restaurant> | null>(null);
  const [arrived, setArrived] = useState(false);
  const [special, setSpecial] = useState<SpecialPrice | undefined>(undefined);
  // 링크로 들어온 사람도 돌아가는 걸 보고 나서 답을 만난다. 마운트 직후에 걸어야
  // 첫 프레임의 정지 상태에서 회전이 시작된다.
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    fetch("/restaurants.json")
      .then(r => r.json())
      .then((data: Restaurant[]) => setNames(new Map(data.map(r => [r.kakao_place_id, r]))))
      .catch(() => setNames(new Map()));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSpinning(true), 400);
    return () => clearTimeout(t);
  }, []);

  // 당첨 가게의 점심특선 제보. 이 화면은 MapApp 밖이라 요약 맵이 없어 직접 묻는다.
  const specialFor = draw ? draw.placeIds[draw.winner] : null;
  useEffect(() => {
    if (!specialFor) return;
    fetch(`/api/specials?placeId=${specialFor}`)
      .then(r => r.json())
      .then(d => {
        const rows: { menu_name: string; price: number }[] = d.specials ?? [];
        if (rows.length === 0) return;
        const cheapest = rows.reduce((a, b) => (b.price < a.price ? b : a));
        setSpecial({ menuName: cheapest.menu_name, price: cheapest.price });
      })
      .catch(() => {});
  }, [specialFor]);

  if (!draw) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
        <div>
          <p className="text-lg font-bold text-on-surface">읽을 수 없는 링크예요</p>
          <p className="mt-2 text-sm text-on-surface-variant">주소가 잘리거나 바뀐 것 같아요.</p>
          <Link
            className="mt-6 inline-grid h-11 place-items-center rounded-lg bg-primary px-5 text-sm font-bold text-on-primary"
            href="/"
          >
            지도로 가기
          </Link>
        </div>
      </main>
    );
  }

  const winnerId = draw.placeIds[draw.winner];
  const labels = draw.placeIds.map(id => names?.get(id)?.name ?? "…");
  const winnerPlace = names?.get(winnerId) ?? null;

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-surface-container-lowest px-5 py-8">
      <Link className="text-sm text-primary underline" href="/">← 지도로 가기</Link>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-on-surface">룰렛 결과</h1>
      <p className="mt-1 text-sm text-on-surface-variant">후보 {draw.placeIds.length}곳 중에 뽑혔어요.</p>

      <div className="mt-6">
        <RouletteWheel
          names={labels}
          winner={spinning ? draw.winner : null}
          arrived={arrived}
          onArrive={() => setArrived(true)}
        />
      </div>

      <div className="mt-6 min-h-[7rem] rounded-lg bg-surface-container p-5">
        <p className="text-center text-sm text-on-surface-variant">
          {arrived ? "오늘 점심은" : "돌아가는 중…"}
        </p>
        {arrived && (
          <p className="mt-1 text-center text-2xl font-bold text-on-surface">
            {winnerPlace ? winnerPlace.name : names === null ? "…" : "사라진 가게"}
          </p>
        )}
        {arrived && winnerPlace && (
          <>
            <p className="mt-1 text-center text-sm text-on-surface-variant">
              {winnerPlace.category} · 씨드큐브에서 {winnerPlace.distance_km}km
            </p>
            {/* 뭘 파는 곳인지 여기서 알려주지 않으면 결국 카카오맵을 다시 연다 */}
            <div className="mt-4 border-t border-outline-variant pt-4">
              <MenuLines menus={winnerPlace.menus} special={special} max={4} />
            </div>
          </>
        )}
      </div>

      {arrived && winnerPlace && (
        <Link
          className="mt-4 grid h-11 w-full place-items-center rounded-lg bg-primary text-base font-bold text-on-primary"
          href={sharePath(winnerId)}
        >
          가게 보러 가기
        </Link>
      )}
    </main>
  );
}
