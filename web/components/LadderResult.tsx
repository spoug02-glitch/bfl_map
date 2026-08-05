"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LadderBoard from "@/components/LadderBoard";
import MenuLines from "@/components/MenuLines";
import { Restaurant } from "@/lib/constants";
import { buildLadder, followLeg } from "@/lib/ladder";
import { sharePath } from "@/lib/share-copy";
import type { LadderDraw } from "@/lib/ladder-link";

/**
 * 공유 링크로 들어온 사람이 보는 화면. 링크에 담긴 seed로 같은 사다리를 다시
 * 그리고, 당첨 자리에 도착하는 출발 줄을 역산해 그 경로를 보여준다.
 */
export default function LadderResult({ draw }: { draw: LadderDraw | null }) {
  const [names, setNames] = useState<Map<string, Restaurant> | null>(null);
  // 링크로 들어온 사람도 선이 내려가는 걸 보고 나서 답을 만난다.
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    fetch("/restaurants.json")
      .then(r => r.json())
      .then((data: Restaurant[]) => setNames(new Map(data.map(r => [r.kakao_place_id, r]))))
      .catch(() => setNames(new Map()));
  }, []);

  const ladder = useMemo(
    () => (draw ? buildLadder(draw.placeIds.length, draw.seed) : null),
    [draw],
  );
  // 어느 줄에서 출발해야 그 결과가 나오는지. 사다리는 출발이 다르면 도착도 달라서
  // 반드시 하나만 나온다.
  const start = useMemo(() => {
    if (!draw || !ladder) return null;
    const i = draw.placeIds.findIndex((_, leg) => followLeg(ladder, leg) === draw.winner);
    return i < 0 ? null : i;
  }, [draw, ladder]);

  if (!draw || !ladder) {
    return (
      <main className="grid min-h-dvh place-items-center bg-surface-page px-6 text-center">
        <div>
          <p className="text-lg font-bold text-text-primary">읽을 수 없는 링크예요</p>
          <p className="mt-2 text-sm text-text-muted">주소가 잘리거나 바뀐 것 같아요.</p>
          <Link
            className="mt-6 inline-grid h-11 place-items-center rounded-lg bg-ink px-5 text-sm font-bold text-white"
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
    <main className="mx-auto min-h-dvh max-w-md bg-surface px-5 py-8">
      <Link className="text-sm text-accent underline" href="/">← 지도로 가기</Link>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-text-primary">사다리 결과</h1>
      <p className="mt-1 text-sm text-text-muted">후보 {draw.placeIds.length}곳 중에 뽑혔어요.</p>

      <div className="mt-6">
        <LadderBoard
          ladder={ladder}
          names={labels}
          winner={draw.winner}
          start={start}
          arrived={arrived}
          onArrive={() => setArrived(true)}
        />
      </div>

      <div className="mt-6 min-h-[7rem] rounded-lg bg-surface-muted p-5">
        <p className="text-center text-sm text-text-muted">
          {arrived ? "오늘 점심은" : "내려가는 중…"}
        </p>
        {arrived && (
        <p className="mt-1 text-center text-2xl font-bold text-text-primary">
          {winnerPlace ? winnerPlace.name : names === null ? "…" : "사라진 가게"}
        </p>
        )}
        {arrived && winnerPlace && (
          <>
            <p className="mt-1 text-center text-sm text-text-muted">
              {winnerPlace.category} · 씨드큐브에서 {winnerPlace.distance_km}km
            </p>
            {/* 뭘 파는 곳인지 여기서 알려주지 않으면 결국 카카오맵을 다시 연다 */}
            <div className="mt-4 border-t border-border-subtle pt-4">
              <MenuLines menus={winnerPlace.menus} max={4} />
            </div>
          </>
        )}
      </div>

      {arrived && winnerPlace && (
        <Link
          className="mt-4 grid h-11 w-full place-items-center rounded-lg bg-ink text-base font-bold text-white"
          href={sharePath(winnerId)}
        >
          가게 보러 가기
        </Link>
      )}
    </main>
  );
}
