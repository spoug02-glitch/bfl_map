"use client";

import { useMemo, useState } from "react";
import LadderBoard from "@/components/LadderBoard";
import { Restaurant, isConvenienceStore, normalizeQuery } from "@/lib/constants";
import { buildLadder, followLeg } from "@/lib/ladder";
import { MAX_LEGS, MIN_LEGS, encodeLadder } from "@/lib/ladder-link";

type Props = {
  /** 현재 필터·반경을 통과한 가게들. "랜덤으로 채우기"가 여기서 뽑는다. */
  pool: Restaurant[];
  savedPlaces: Restaurant[];
  onClose: () => void;
};

const RANDOM_PICK = 4;

/**
 * 랜덤으로 뽑을 때만 적용하는 반경(km). 사다리로 정하는 건 "지금 나가서 먹을 곳"이라
 * 걸어갈 거리 안이어야 한다.
 *
 * 실측(2026-08-05): 100m 안 10곳, 150m 41곳, 200m 69곳. 100m는 후보가 얕아
 * 뽑을 때마다 같은 얼굴이 나오고, 업종 필터를 하나만 걸어도 1~2곳으로 줄어든다.
 */
const RANDOM_RADIUS_KM = 0.1;

export default function LadderPanel({ pool, savedPlaces, onClose }: Props) {
  const [picked, setPicked] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState("");
  // start가 null이면 사다리는 놓였지만 아직 자리를 안 고른 상태다. -1 같은 값을
  // 쓰면 followLeg가 그걸 그대로 돌려줘 "당첨 -1번"이 되어버린다.
  const [draw, setDraw] = useState<{ seed: number; start: number | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const full = picked.length >= MAX_LEGS;

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

  // 랜덤 후보는 걸어갈 거리 안의 밥집에서만 고른다. 편의점이 뽑히면 "점심 뭐 먹지"에
  // 대한 답이 안 된다. 검색으로 직접 담는 건 두 제한을 다 받지 않는다 — 멀어도,
  // 편의점이라도, 오늘 거기 가겠다는 건 본인이 아는 법이다.
  const nearby = useMemo(
    () => pool.filter(r => r.distance_km <= RANDOM_RADIUS_KM && !isConvenienceStore(r.category)),
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

  const ladder = useMemo(
    () => (draw ? buildLadder(picked.length, draw.seed) : null),
    [draw, picked.length],
  );
  const winner =
    ladder && draw && draw.start !== null ? followLeg(ladder, draw.start) : null;

  const start = () => setDraw({ seed: Math.floor(Math.random() * 1_000_000), start: null });

  const pick = (leg: number) => {
    if (!draw) return;
    setDraw({ ...draw, start: leg });
  };

  const shareUrl = () => {
    if (!draw || winner === null) return "";
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin;
    const token = encodeLadder({
      placeIds: picked.map(p => p.kakao_place_id),
      winner,
      seed: draw.seed,
    });
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
        <h2 className="text-xl font-bold text-text-primary">사다리로 정하기</h2>
        <button
          aria-label="닫기"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl text-text-primary"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {!draw ? (
        <>
          <p className="mt-1 text-sm text-text-muted">
            후보를 {MIN_LEGS}~{MAX_LEGS}곳 고르면 사다리를 놓아드려요.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              className="h-11 flex-1 rounded-lg bg-surface-muted text-sm font-bold text-text-primary disabled:opacity-50"
              disabled={full || savedPlaces.length === 0}
              onClick={addSaved}
            >
              저장한 곳 담기
            </button>
            <button
              className="h-11 flex-1 rounded-lg bg-surface-muted text-sm font-bold text-text-primary disabled:opacity-50"
              disabled={full || nearby.length === 0}
              onClick={fillRandom}
            >
              랜덤 {RANDOM_PICK}곳
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            랜덤은 {RANDOM_RADIUS_KM * 1000}m 안 밥집 {nearby.length}곳에서 뽑아요 (편의점 제외).
            검색으로 담는 건 제한이 없어요.
          </p>

          <input
            className="mt-2 h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary placeholder:text-text-muted"
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

          <ul className="mt-4 space-y-1">
            {picked.map((r, i) => (
              <li
                key={r.kakao_place_id}
                className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2"
              >
                <span className="w-5 shrink-0 text-xs font-bold text-text-muted">{i + 1}</span>
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
          {picked.length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">아직 담은 곳이 없어요.</p>
          )}

          <button
            className="mt-4 grid h-11 w-full place-items-center rounded-lg bg-ink text-base font-bold text-white disabled:opacity-50"
            disabled={picked.length < MIN_LEGS}
            onClick={start}
          >
            {picked.length < MIN_LEGS ? `${MIN_LEGS}곳 이상 담아주세요` : "사다리 놓기"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-text-muted">
            {draw.start === null ? "출발할 자리를 골라주세요." : "결과가 나왔어요."}
          </p>
          <div className="mt-4">
            <LadderBoard
              ladder={ladder!}
              names={picked.map(p => p.name)}
              winner={winner}
              start={draw.start}
              onPick={pick}
            />
          </div>

          {winner !== null && (
            <div className="mt-5 rounded-lg bg-surface-muted p-4 text-center">
              <p className="text-sm text-text-muted">오늘 점심은</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{picked[winner].name}</p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              className="h-11 flex-1 rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
              onClick={() => setDraw(null)}
            >
              후보 고치기
            </button>
            <button
              className="h-11 flex-1 rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
              disabled={winner === null}
              onClick={copy}
            >
              {copied ? "복사했어요" : "결과 링크 복사"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
