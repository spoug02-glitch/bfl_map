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
};

export const NO_DISLIKES: Dislikes = { presets: [], custom: [] };

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

function read(): Dislikes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return NO_DISLIKES;
    const parsed = JSON.parse(raw) as Partial<Dislikes>;
    return {
      presets: Array.isArray(parsed.presets) ? parsed.presets.filter(x => typeof x === "string") : [],
      custom: Array.isArray(parsed.custom) ? parsed.custom.filter(x => typeof x === "string") : [],
    };
  } catch {
    // 손상된 값이나 접근 차단(사생활 보호 모드)에서도 앱은 계속 떠야 한다
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

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useDislikes(): Dislikes {
  return useSyncExternalStore(subscribe, () => current, () => NO_DISLIKES);
}
