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
 * 보내는 값은 전부 공개 정보이거나 열거형 상수다.
 * 닉네임·user_id·리뷰 본문·이메일은 어떤 이벤트에도 넣지 않는다.
 */
export type TrackEvent =
  | { name: "place_view"; place_id: string; place_category: string; entry_context: EntryContext }
  | { name: "place_map_open"; place_id: string; place_category: string }
  | { name: "blog_review_click"; place_id: string; place_category: string }
  | { name: "place_share"; place_id: string; method: "kakao" | "web_share" | "copy" }
  | { name: "roulette_share"; pool_size: number }
  | { name: "review_submit"; place_id: string; place_category: string }
  | { name: "place_engage"; place_id: string; action: "save" | "special" }
  | { name: "login_start"; trigger: "header" | "review" }
  | { name: "roulette_result"; pool_size: number; winner_category: string };

type GtagFn = (command: "event", name: string, params: Record<string, unknown>) => void;

export function track(event: TrackEvent): void {
  if (!GA_ID) return;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== "function") return;
  const { name, ...params } = event;
  gtag("event", name, params);
}
