export const OFFICE_LABEL = "창동씨드큐브";
export const CENTER = { lat: 37.6545, lng: 127.0499 }; // 창동씨드큐브
export const RADIUS_KM = 5.0;

/** 브라우저가 아는 로그인 상태. `nickname`이 null이면 아직 닉네임을 안 정한 것이다. */
export type SessionUser = { userId: string; nickname: string | null };

/** blog_links.json: kakao_place_id -> 만든 이가 쓴 후기 */
export interface BlogLink {
  url: string;
  title: string;
}

/** 카카오 place_id는 숫자 문자열이다. 외부에서 들어온 값은 이걸 통과해야 한다. */
export const PLACE_ID_RE = /^\d{1,20}$/;

/**
 * 카카오 panel3은 **가격 미공개를 `-1`로** 준다 — 수집한 메뉴 20,560개 중 5,132개가
 * 그렇고, 빈 문자열도 121개 온다. 문자열 truthy 검사만 하면 화면에 `-1원`이 찍힌다.
 * 가격이 실제 숫자일 때만 표기하고, 아니면 null을 돌려 호출부가 아예 빼도록 한다.
 */
export function formatPrice(price: string): string | null {
  const n = Number(price);
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("ko-KR")}원` : null;
}

/** 점심값 상한. 식대 지원 한도로 가장 흔한 값이다. */
export const CHEAP_LIMIT = 10000;

/** "1만원 이하". 좁은 화면에서 반경 슬라이더와 한 줄을 나눠 써야 해 짧게 쓴다. */
export const CHEAP_LABEL = `${CHEAP_LIMIT / 10000}만원 이하`;

/**
 * 표시된 메뉴 중 가장 싼 값. 쓸 수 있는 가격이 하나도 없으면 null이다.
 *
 * 카카오가 주는 메뉴는 가게당 최대 5개라 이건 그 가게의 진짜 최저가가 아니라
 * "표시된 메뉴 중 최저가"다. 화면 문구도 그 이상을 약속하지 않는다.
 *
 * 미공개(-1)와 빈 문자열을 반드시 걸러야 한다 — 그냥 Number()로 받으면 최저가가
 * -1이 되어 모든 가게가 상한을 통과해버린다. formatPrice와 같은 기준이다.
 */
export function cheapestMenu<T extends { price: string }>(menus: T[]): T | null {
  let best: T | null = null;
  let min = Infinity;
  for (const m of menus) {
    const n = Number(m.price);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (n < min) { min = n; best = m; }
  }
  return best;
}

export function minMenuPrice(menus: { price: string }[]): number | null {
  const m = cheapestMenu(menus);
  return m ? Number(m.price) : null;
}

export const CONVENIENCE_CATEGORY = "체인화 편의점";

/** 편의점은 메뉴 개념이 없어 수집 단계에서 메뉴를 조회하지 않는다 → 메뉴 섹션 자체를 숨긴다. */
export function isConvenienceStore(category: string): boolean {
  return category === CONVENIENCE_CATEGORY;
}

/** 카페·빵집. 업종 목록은 CATEGORY_GROUPS 하나만 두고 여기서 끌어 쓴다. */
export function isCafe(category: string): boolean {
  return CATEGORY_GROUPS["카페·빵"].includes(category);
}

/**
 * 사다리 랜덤이 뽑아도 되는 자리인가.
 *
 * 편의점과 카페는 "점심 뭐 먹지"의 답이 아니다 — 커피 한 잔이 뽑히면 다시
 * 돌리게 된다. 검색으로 직접 담는 건 막지 않는다.
 */
export function isMealPlace(category: string): boolean {
  return !isConvenienceStore(category) && !isCafe(category);
}

/** 진입 토스트와 푸터가 공유하는 주의 문구 (문구 중복 금지). */
export const CONVENIENCE_NOTICE =
  "편의점은 회사 식권 정책에 따라 결제가 제한될 수 있어요. 사내 규정을 확인해주세요.";

/**
 * 공유 카드 이미지 경로. 쿼리는 카카오 캐시를 깨는 버전이다.
 *
 * 카카오는 이미지를 자기 프록시로 가져가며 URL별로 결과를 캐시하는데, 실패도
 * 캐시한다. 처음 배포된 날 Vercel Security Checkpoint(봇 차단)가 켜져 있어
 * 카카오가 챌린지 응답을 물고 갔고, 그 뒤로 서버가 멀쩡해져도 카드에 이미지가
 * 안 떴다. 파일을 바꾸면 반드시 버전을 올릴 것 — 같은 주소로는 다시 안 가져간다.
 */
export const OG_CARD_PATH = "/og-card.png?v=2";

export const CREDIT = { author: "노에마", email: "obanaeodzb@naver.com" };

/** Mirrors the character-stripping half of collector/brands.py `normalize`.
 *  Only the raw query needs this — alias expansion is already baked into each
 *  row's `search_keys` by the collector, so the alias table is NOT duplicated here. */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[\s　.·\-_,&/()[\]{}]/g, "");
}

// zeropay BIZ_TYPE label -> UI chip group
// NOTE: zeropay DB uses inconsistent spacing across records — include both variants
export const CATEGORY_GROUPS: Record<string, string[]> = {
  한식: ["한식 일반 음식점업", "한식 육류 요리 전문점", "한식 육류요리 전문점"],
  중식: ["중식 음식점업"],
  일식: ["일식 음식점업"],
  양식: ["서양식 음식점업"],
  "카페·빵": ["커피 전문점", "제과점업"],
  치킨: ["치킨 전문점"],
  "피자·버거": ["피자, 햄버거, 샌드위치 및 유사 음식점업"],
  분식: ["김밥 및 기타 간이 음식점업", "간이음식 포장 판매 전문점", "간이 음식 포장 판매 전문점"],
  편의점: ["체인화 편의점"],
};

export interface Restaurant {
  name: string;
  /** Precomputed brand/spelling-tolerant search keys from collector/brands.py.
   *  Search against these, never against `name` — that is what makes a query
   *  "CU" find a store the source data spells "씨유". Never re-declare the
   *  alias table here; the collector owns it. */
  search_keys: string[];
  address: string;
  category: string;
  phone: string;
  lat: number;
  lng: number;
  distance_km: number;
  kakao_place_id: string;
  kakao_url: string;
  menus: { name: string; price: string }[];
}
