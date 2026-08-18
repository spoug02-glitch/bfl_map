/**
 * 메뉴 한 줄이 어디서 왔는지. 이 다섯 개가 전부이고 menu_items 의 CHECK 제약과 같은
 * 집합이다 — 한쪽만 늘리면 DB가 거부하거나 화면이 빈 라벨을 그린다.
 *
 * legacy_import 는 카카오 비공식 endpoint 에서 온 기존 데이터를 위한 자리다. 다른
 * 출처와 섞이면 "숨기고 순차 교체"라는 선택지 자체가 구현 불가능해진다.
 *
 * public_api 가 아니라 public_data 인 이유: 공공데이터는 API 로만 오지 않는다.
 * 파일 배포(CSV·XLSX)가 흔하고, 그때 _api 라는 이름은 거짓말이 된다.
 */
export type MenuSourceType =
  | "public_data"
  | "owner"
  | "user_report"
  | "official_source"
  | "legacy_import";

export type MenuStatus = "pending" | "published" | "rejected";

export type DbMenuItem = {
  menuName: string;
  /** 가격 미상은 null 이다. 카카오의 -1 은 DB 로 들어올 때 이미 정규화됐다. */
  price: number | null;
  sourceType: MenuSourceType;
  status: MenuStatus;
  verifiedAt: string | null;
};

const LABELS: Record<MenuSourceType, string> = {
  public_data: "공공데이터",
  owner: "가게 제공",
  user_report: "이용자 제보",
  official_source: "공식 출처",
  // 카카오에서 긁어온 것을 "카카오 제공"이라 쓰면 제공받은 것처럼 읽힌다.
  legacy_import: "출처 확인 중",
};

export function sourceLabel(t: MenuSourceType): string {
  return LABELS[t];
}

/** 서로 다른 두 사람의 제보를 같은 가격으로 볼 허용 오차. */
export const PRICE_AGREEMENT_RATIO = 0.2;

/**
 * 두 제보 가격이 일치한다고 볼지.
 *
 * 허용 오차를 작은 쪽 가격에 건다. 큰 쪽에 걸어도 인자 순서와 무관한 건 마찬가지지만
 * (min 도 max 도 대칭이다), 작은 쪽이 더 엄격하다 — 8,000 과 10,000 은 큰 쪽 기준이면
 * 딱 경계에 걸려 통과하고 작은 쪽 기준이면 탈락한다.
 *
 * 엄격한 쪽을 고른 이유는 이 함수가 하는 일이 "뒷받침"이기 때문이다. 느슨하면 서로
 * 다른 메뉴를 말한 두 제보가 같은 가격을 말한 것으로 묶여 확정된다. 확정을 놓치는
 * 비용은 제보 한 건 더 기다리는 것이고, 잘못 확정하는 비용은 틀린 가격이 필터에
 * 들어가는 것이다.
 */
export function pricesAgree(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.min(a, b) * PRICE_AGREEMENT_RATIO;
}

/**
 * 가격 필터가 볼 그 가게의 DB 최저가. 쓸 수 있는 값이 없으면 null 이다.
 *
 * published 만 센다. pending 을 세면 확정되지 않은 한 사람의 제보가 필터를
 * 통과시키게 되고, 그건 status 컬럼을 만든 이유를 그대로 무효로 만든다.
 */
export function dbMinPrice(items: DbMenuItem[]): number | null {
  let min: number | null = null;
  for (const it of items) {
    if (it.status !== "published") continue;
    if (it.price === null || !Number.isFinite(it.price) || it.price <= 0) continue;
    if (min === null || it.price < min) min = it.price;
  }
  return min;
}
