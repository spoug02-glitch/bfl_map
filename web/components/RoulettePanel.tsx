"use client";

import { useMemo, useState } from "react";
import MenuLines from "@/components/MenuLines";
import RouletteWheel from "@/components/RouletteWheel";
import { Restaurant, SpecialPrice, isMealPlace, normalizeQuery } from "@/lib/constants";
import { MAX_LEGS, MIN_LEGS, encodeLadder } from "@/lib/ladder-link";
import { sliceColor, sliceLabel } from "@/lib/roulette";

type Props = {
  /** 현재 필터·반경을 통과한 가게들. "랜덤으로 채우기"가 여기서 뽑는다. */
  pool: Restaurant[];
  savedPlaces: Restaurant[];
  /** 가게별 최저가 점심특선 제보. 당첨 가게의 메뉴 줄에 얹는다. */
  specialPrices: Map<string, SpecialPrice>;
  onClose: () => void;
};

const RANDOM_PICK = 4;

/**
 * 랜덤으로 뽑을 때만 적용하는 반경(km). 룰렛으로 정하는 건 "지금 나가서 먹을 곳"이라
 * 걸어갈 거리 안이어야 한다.
 *
 * 실측(2026-08-05, 편의점 제외): 100m 10곳, 150m 38곳, 200m 64곳.
 * 100m로 두면 10곳에서 4곳을 뽑는 셈이라 돌릴 때마다 절반이 겹쳐 돌리는 재미가
 * 없다. 150m면 조합이 매번 달라지고, 걸어서 2분이라 취지도 유지된다.
 */
const RANDOM_RADIUS_KM = 0.15;

export default function RoulettePanel({ pool, savedPlaces, specialPrices, onClose }: Props) {
  const [picked, setPicked] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState("");
  const [draw, setDraw] = useState<{ seed: number; winner: number } | null>(null);
  // 원판이 멈추기 전까지는 답을 감춘다. 미리 보여주면 돌릴 이유가 없다.
  const [arrived, setArrived] = useState(false);
  const [copied, setCopied] = useState(false);

  const full = picked.length >= MAX_LEGS;
  const winner = draw?.winner ?? null;

  const add = (r: Restaurant) => {
    setQuery("");
    setPicked(prev =>
      prev.length >= MAX_LEGS || prev.some(p => p.kakao_place_id === r.kakao_place_id)
        ? prev
        : [...prev, r],
    );
  };
  const remove = (id: string) => setPicked(prev => prev.filter(p => p.kakao_place_id !== id));

  const matches = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return [];
    const chosen = new Set(picked.map(p => p.kakao_place_id));
    return pool
      .filter(r => !chosen.has(r.kakao_place_id) && r.search_keys.some(k => k.includes(q)))
      .slice(0, 6);
  }, [query, pool, picked]);

  // 랜덤 후보는 걸어갈 거리 안의 밥집에서만 고른다. 검색으로 직접 담는 건 거리도
  // 업종도 제한하지 않는다 — 멀어도, 카페라도, 오늘 거기 가겠다는 건 본인이 안다.
  const nearby = useMemo(
    () => pool.filter(r => r.distance_km <= RANDOM_RADIUS_KM && isMealPlace(r.category)),
    [pool],
  );

  const fillRandom = () => {
    const chosen = new Set(picked.map(p => p.kakao_place_id));
    const rest = nearby.filter(r => !chosen.has(r.kakao_place_id));
    // Fisher–Yates로 앞쪽만 섞는다. 정렬로 뽑으면 앞순번이 계속 뽑힌다.
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    setPicked(prev => [...prev, ...rest.slice(0, Math.min(RANDOM_PICK, MAX_LEGS - prev.length))]);
  };

  const addSaved = () => {
    const chosen = new Set(picked.map(p => p.kakao_place_id));
    const rest = savedPlaces.filter(r => !chosen.has(r.kakao_place_id));
    setPicked(prev => [...prev, ...rest.slice(0, MAX_LEGS - prev.length)]);
  };

  const spin = () => {
    setArrived(false);
    setDraw({
      seed: Math.floor(Math.random() * 1_000_000),
      winner: Math.floor(Math.random() * picked.length),
    });
  };

  const shareUrl = () => {
    if (!draw) return "";
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
    const token = encodeLadder({
      placeIds: picked.map(p => p.kakao_place_id),
      winner: draw.winner,
      seed: draw.seed,
    });
    // 경로는 /ladder 그대로다 — 이미 나간 공유 링크가 계속 열려야 한다.
    return `${base}/ladder/${token}`;
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-20 max-h-[75dvh] w-full overflow-y-auto
        rounded-t-2xl border-t border-border-subtle bg-surface p-4 shadow-lg
        md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-none
        md:w-full md:max-w-sm md:rounded-none md:border-l md:border-t-0"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-bold text-text-primary">룰렛으로 정하기</h2>
        <button
          aria-label="닫기"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl text-text-primary"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <p className="mt-1 text-sm text-text-muted">
        {draw === null
          ? `후보를 ${MIN_LEGS}~${MAX_LEGS}곳 담고 돌리면 한 곳을 뽑아드려요.`
          : arrived
            ? "결과가 나왔어요."
            : "돌아가는 중…"}
      </p>

      <div className="mt-4">
        <RouletteWheel
          names={picked.map(p => p.name)}
          winner={winner}
          arrived={arrived}
          onArrive={() => setArrived(true)}
        />
      </div>

      {draw === null ? (
        <>
          {/* 담기 수단은 필터 칩과 같은 테두리 칩으로 둔다 — 회색 채움은 입력창과
              CTA에 양보해서, 화면이 회색 사각형 네 개로 읽히지 않게 한다. */}
          <p className="mt-5 text-xs font-bold text-text-muted">후보 담기</p>
          <div className="mt-2 flex gap-2">
            <button
              className="h-11 flex-1 rounded-xl border border-border bg-surface text-sm font-bold text-text-primary disabled:opacity-50"
              disabled={full || savedPlaces.length === 0}
              onClick={addSaved}
            >
              <span aria-hidden>☆</span> 저장한 곳 담기
            </button>
            <button
              className="h-11 flex-1 rounded-xl border border-border bg-surface text-sm font-bold text-text-primary disabled:opacity-50"
              disabled={full || nearby.length === 0}
              onClick={fillRandom}
            >
              <span aria-hidden>🎲</span> 랜덤 {RANDOM_PICK}곳
            </button>
          </div>
          <p className="mt-1.5 text-xs text-text-muted">
            랜덤은 {RANDOM_RADIUS_KM * 1000}m 안 밥집 {nearby.length}곳에서 뽑아요 ·
            편의점·카페는 빼요 · 검색은 제한 없음
          </p>

          <input
            className="mt-3 h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary placeholder:text-text-muted"
            placeholder="가게 이름으로 찾아 담기"
            value={query}
            disabled={full}
            onChange={e => setQuery(e.target.value)}
          />
          {matches.length > 0 && (
            <ul className="mt-1 rounded-lg border border-border-subtle">
              {matches.map(r => (
                <li key={r.kakao_place_id} className="border-b border-border-subtle/60 last:border-b-0">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    onClick={() => add(r)}
                  >
                    <span className="w-12 shrink-0 font-bold text-accent">
                      {r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)}m` : `${r.distance_km.toFixed(1)}km`}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-text-primary">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked.length > 0 && (
            <>
              <p className="mt-5 text-xs font-bold text-text-muted">
                담은 후보 <span className="text-text-primary">{picked.length}</span>/{MAX_LEGS}
              </p>
              <ul className="mt-2 space-y-1">
                {picked.map((r, i) => (
                  <li
                    key={r.kakao_place_id}
                    className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2"
                  >
                    {/* 목록의 글자와 원판의 조각을 같은 색으로 묶는다 */}
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                      style={{ background: sliceColor(i) }}
                    >
                      {sliceLabel(i)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{r.name}</span>
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center text-text-muted"
                      aria-label={`${r.name} 빼기`}
                      onClick={() => remove(r.kakao_place_id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            className="mt-4 grid h-11 w-full place-items-center rounded-lg bg-ink text-base font-bold text-white disabled:opacity-50"
            disabled={picked.length < MIN_LEGS}
            onClick={spin}
          >
            {picked.length < MIN_LEGS ? `${MIN_LEGS}곳 이상 담아주세요` : "돌리기"}
          </button>
        </>
      ) : (
        <>
          {winner !== null && arrived && (
            <div className="mt-5 rounded-lg bg-surface-muted p-4">
              <p className="text-center text-sm text-text-muted">오늘 점심은</p>
              <p className="mt-1 text-center text-xl font-bold text-text-primary">
                {picked[winner].name}
              </p>
              <p className="mt-1 text-center text-xs text-text-muted">
                {picked[winner].category} ·{" "}
                {picked[winner].distance_km < 1
                  ? `${Math.round(picked[winner].distance_km * 1000)}m`
                  : `${picked[winner].distance_km.toFixed(1)}km`}
              </p>
              <div className="mt-3 border-t border-border-subtle pt-3">
                <MenuLines
                  menus={picked[winner].menus}
                  special={specialPrices.get(picked[winner].kakao_place_id)}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              className="h-11 flex-1 rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
              onClick={() => { setDraw(null); setArrived(false); }}
            >
              후보 고치기
            </button>
            <button
              className="h-11 flex-1 rounded-lg bg-surface-muted text-sm font-bold text-text-primary disabled:opacity-50"
              disabled={!arrived}
              onClick={spin}
            >
              다시 돌리기
            </button>
          </div>
          <button
            className="mt-2 h-11 w-full rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
            disabled={!arrived}
            onClick={copy}
          >
            {copied ? "복사했어요" : "결과 링크 복사"}
          </button>
        </>
      )}
    </aside>
  );
}
