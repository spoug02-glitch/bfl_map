"use client";

import { useSyncExternalStore } from "react";
import { Restaurant, normalizeQuery } from "@/lib/constants";

/**
 * 안 먹는 음식. 개인 설정이라 계정이 아니라 이 브라우저에 남는다 —
 * 로그인 안 해도 쓸 수 있어야 하고, 서버가 알 이유도 없다.
 */
const STORAGE_KEY = "bfl.dislikes";

export type Dislikes = {
  /** 고른 프리셋 key들 */
  presets: string[];
  /** 직접 적은 말들 */
  custom: string[];
  /**
   * 그냥 안 가고 싶은 가게의 kakao_place_id.
   *
   * 음식 종류로는 못 거르는 게 있다 — 저 집은 그냥 싫다든가, 지난번에 별로였다든가.
   * 키워드를 짜내게 하는 대신 가게에서 바로 뺀다.
   */
  places: string[];
};

export const NO_DISLIKES: Dislikes = { presets: [], custom: [], places: [] };

/**
 * 자주 갈리는 것들만 추린다. 키워드는 짧을수록 위험하다 — "회" 하나면
 * 회사·회관·회덮밥이 다 걸려서, 그 음식을 특정하는 말만 넣는다.
 */
export const DISLIKE_PRESETS: { key: string; label: string; keywords: string[] }[] = [
  // "회" 한 글자는 회사·회관까지 걸어버려 못 쓴다. 대신 회 전문점의 이름에
  // 실제로 들어가는 말을 넣는다 — 해신참치 같은 집이 "초밥"만으로는 안 걸렸다.
  { key: "sushi", label: "초밥·회", keywords: ["초밥", "스시", "사시미", "횟집", "오마카세", "회전초밥", "참치", "물회", "모둠회"] },
  { key: "pho", label: "쌀국수", keywords: ["쌀국수", "베트남", "분짜", "포보"] },
  { key: "gopchang", label: "곱창·순대", keywords: ["곱창", "막창", "대창", "순대"] },
  { key: "mala", label: "마라·양꼬치", keywords: ["마라", "양꼬치", "훠궈", "훠거"] },
  { key: "burger", label: "햄버거", keywords: ["버거", "맥도날드", "롯데리아", "맘스터치"] },
  // 브랜드 이름을 같이 넣는다. 카카오 업종은 "피자, 햄버거, 샌드위치 및 유사
  // 음식점업" 한 칸에 15곳을 몰아넣어 써먹을 수 없고(샌드위치를 빼면 피자집이
  // 사라진다), 써브웨이는 이름에도 메뉴("이탈리안 비엠티")에도 그 말이 없다.
  { key: "sandwich", label: "샌드위치·토스트", keywords: ["샌드위치", "써브웨이", "subway", "토스트", "홍루이젠", "샐러드"] },
  { key: "raw", label: "육회·날것", keywords: ["육회", "육사시미", "생연어"] },
];

/** 설정을 실제 검색어들로 편다. 저장은 사람이 고른 모양대로, 비교는 이 목록으로. */
export function dislikeKeywords(d: Dislikes): string[] {
  const fromPresets = d.presets.flatMap(
    key => DISLIKE_PRESETS.find(p => p.key === key)?.keywords ?? [],
  );
  const fromCustom = d.custom.map(normalizeQuery).filter(w => w.length > 0);
  return [...fromPresets.map(normalizeQuery), ...fromCustom];
}

/** 메뉴 중 몇 개나 걸리면 "그 집"으로 볼지. 과반이다. */
function isMajority(hit: number, total: number): boolean {
  return hit * 2 > total;
}

/**
 * 이 가게를 빼야 하나.
 *
 * 메뉴에 한 번 걸렸다고 빼지 않는다 — 한식집 메뉴판에 초밥 한 줄 있다고 그 집을
 * 지우면 갈 데가 없어진다. 그 음식이 **그 집의 정체**일 때만 뺀다:
 * 이름에 있거나(오스시, 미스사이공), 표시된 메뉴의 과반이 그것이거나.
 */
export function isDisliked(place: Restaurant, keywords: string[]): boolean {
  if (keywords.length === 0) return false;

  // search_keys는 수집기가 별칭까지 정규화해 넣어둔 이름들이다
  if (place.search_keys.some(k => keywords.some(w => k.includes(w)))) return true;

  const menus = place.menus;
  if (menus.length === 0) return false;
  const hit = menus.filter(m => {
    const name = normalizeQuery(m.name);
    return keywords.some(w => name.includes(w));
  }).length;
  return isMajority(hit, menus.length);
}

// ── 저장소 ────────────────────────────────────────────────────────────────
// useSyncExternalStore를 쓰는 이유는 use-reduced-motion과 같다: localStorage는
// 서버에 없고, effect에서 상태를 세우면 첫 렌더가 지나간 뒤다.

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * 저장된 문자열을 설정으로 되돌린다. 저장소와 떼어놔야 테스트할 수 있다.
 *
 * 칸마다 따로 확인한다 — places가 없던 시절에 저장된 설정도 그대로 열려야 하고,
 * 손으로 고친 값이 들어와도 앱이 서면 안 된다.
 */
export function parseDislikes(raw: string | null): Dislikes {
  if (!raw) return NO_DISLIKES;
  try {
    const parsed = JSON.parse(raw) as Partial<Dislikes>;
    if (typeof parsed !== "object" || parsed === null) return NO_DISLIKES;
    return {
      presets: strings(parsed.presets),
      custom: strings(parsed.custom),
      places: strings(parsed.places),
    };
  } catch {
    return NO_DISLIKES;
  }
}

function read(): Dislikes {
  try {
    return parseDislikes(localStorage.getItem(STORAGE_KEY));
  } catch {
    // 사생활 보호 모드에서는 localStorage 접근 자체가 막힌다
    return NO_DISLIKES;
  }
}

let current: Dislikes = typeof window === "undefined" ? NO_DISLIKES : read();
const listeners = new Set<() => void>();

export function setDislikes(next: Dislikes): void {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장이 막혀도 이번 세션에서는 동작한다
  }
  listeners.forEach(fn => fn());
}

/** 이 가게를 빼거나 되돌린다. */
export function setPlaceHidden(placeId: string, hidden: boolean): void {
  const has = current.places.includes(placeId);
  if (has === hidden) return;
  setDislikes({
    ...current,
    places: hidden ? [...current.places, placeId] : current.places.filter(id => id !== placeId),
  });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useDislikes(): Dislikes {
  return useSyncExternalStore(subscribe, () => current, () => NO_DISLIKES);
}
