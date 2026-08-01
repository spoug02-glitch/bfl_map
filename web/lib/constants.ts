export const CENTER = { lat: 37.6545, lng: 127.0499 }; // 창동씨드큐브
export const RADIUS_KM = 5.0;

/** blog_links.json: kakao_place_id -> 만든 이가 쓴 후기 */
export interface BlogLink {
  url: string;
  title: string;
}

export const CONVENIENCE_CATEGORY = "체인화 편의점";

/** 편의점은 메뉴 개념이 없어 수집 단계에서 메뉴를 조회하지 않는다 → 메뉴 섹션 자체를 숨긴다. */
export function isConvenienceStore(category: string): boolean {
  return category === CONVENIENCE_CATEGORY;
}

/** 진입 토스트와 푸터가 공유하는 주의 문구 (문구 중복 금지). */
export const CONVENIENCE_NOTICE =
  "편의점은 회사 식권 정책에 따라 결제가 제한될 수 있어요. 사내 규정을 확인해주세요.";

export const CREDIT = { author: "노에마", email: "spoug02@gmail.com" };

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
