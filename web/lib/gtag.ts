/**
 * GA4 이벤트 발화의 단일 창구.
 *
 * gtag 전역을 만지는 곳은 이 파일 하나다. 컴포넌트는 track()만 부른다.
 * GA_ID가 없거나(로컬·preview·테스트) 광고 차단기가 스크립트를 막았으면
 * 조용히 아무것도 하지 않는다 — 분석 실패가 앱을 멈추면 안 된다.
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/** 가게 상세에 어떻게 도달했는지. RoulettePanel에는 onSelect가 없어 룰렛 값은 없다. */
export type EntryContext = "marker" | "list" | "shared_link";

/**
 * 편의점은 메뉴 개념 자체가 없어 수집 단계에서 아예 조회하지 않는다(725곳).
 * 이걸 그냥 has_menu=false 로 흘리면 "메뉴 없는 그룹"이 사실은 "메뉴 없는 밥집 +
 * 편의점 전부"가 되어, 메뉴 유무 비교가 업종 비교로 바뀐다. 분석에서 걸러낼 수
 * 있도록 종류를 따로 남긴다.
 */
export type PlaceKind = "meal" | "convenience";

/**
 * 보내는 값은 전부 공개 정보이거나 열거형 상수다.
 * 닉네임·user_id·리뷰 본문·이메일은 어떤 이벤트에도 넣지 않는다.
 */
export type TrackEvent =
  // has_menu 는 "화면에 메뉴가 한 줄이라도 떴는가"다 — 미확인(pending) 제보도 센다.
  // 확정된 것만 세는 dbMinPrice 와 기준이 다른 건 의도한 것이다. 여기서 재려는 건
  // 가격 필터가 쓸 수 있는 데이터의 양이 아니라 사용자가 실제로 본 화면이다.
  //
  // menu_count 를 같이 남기는 이유: 나중에 "한 줄 있는 것과 열두 줄 있는 것이 같은
  // 효과인가"를 물으려면 불리언만으로는 답이 안 나온다. 지금 안 남기면 영영 못 센다.
  | {
      name: "place_view";
      place_id: string;
      place_category: string;
      entry_context: EntryContext;
      place_kind: PlaceKind;
      has_menu: boolean;
      menu_count: number;
    }
  | { name: "place_map_open"; place_id: string; place_category: string }
  | { name: "blog_review_click"; place_id: string; place_category: string }
  | { name: "place_share"; place_id: string; method: "kakao" | "web_share" | "copy" }
  | { name: "roulette_share"; pool_size: number }
  | { name: "review_submit"; place_id: string; place_category: string }
  | { name: "place_engage"; place_id: string; action: "save" | "special" }
  | { name: "login_start"; trigger: "header" | "review" }
  | { name: "roulette_result"; pool_size: number; winner_category: string }
  // roulette_again 만 있으면 분모가 없다 — "다시 돌리기가 많다"가 룰렛을 많이 썼다는
  // 뜻인지 결과가 마음에 안 들었다는 뜻인지 가릴 수 없어, 짝인 roulette_result 를
  // 같이 쏜다. 비율로 봐야 의미가 생기는 지표다.
  | { name: "roulette_again"; pool_size: number };

type GtagFn = (command: "event", name: string, params: Record<string, unknown>) => void;

export function track(event: TrackEvent): void {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== "function") return;
  const { name, ...params } = event;
  gtag("event", name, params);
}
