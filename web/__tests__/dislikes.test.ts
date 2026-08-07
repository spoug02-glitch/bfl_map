import { describe, expect, it } from "vitest";
import { DISLIKE_PRESETS, dislikeKeywords, isDisliked } from "@/lib/dislikes";
import type { Restaurant } from "@/lib/constants";
import { normalizeQuery } from "@/lib/constants";

function place(name: string, menuNames: string[]): Restaurant {
  return {
    kakao_place_id: "1",
    name,
    // 수집기가 이름을 정규화해 넣어두는 자리
    search_keys: [normalizeQuery(name)],
    category: "일식 음식점업",
    address: "",
    phone: "",
    kakao_url: "",
    lat: 0,
    lng: 0,
    distance_km: 0.1,
    menus: menuNames.map(n => ({ name: n, price: "10000" })),
  } as Restaurant;
}

const sushi = dislikeKeywords({ presets: ["sushi"], custom: [] });

describe("dislikeKeywords", () => {
  it("프리셋과 직접 입력을 함께 편다", () => {
    const words = dislikeKeywords({ presets: ["pho"], custom: ["고수", "  "] });
    expect(words).toContain("쌀국수");
    expect(words).toContain("고수");
    // 공백만 있는 입력은 버린다 — 안 버리면 모든 가게가 걸린다
    expect(words).not.toContain("");
  });

  it("아무것도 안 고르면 빈 목록이다", () => {
    expect(dislikeKeywords({ presets: [], custom: [] })).toEqual([]);
  });
});

describe("isDisliked", () => {
  it("설정이 비어 있으면 아무도 안 뺀다", () => {
    expect(isDisliked(place("오스시", ["광어초밥"]), [])).toBe(false);
  });

  it("가게 이름에 걸리면 뺀다 — 그게 그 집이다", () => {
    expect(isDisliked(place("오스시", ["계란찜", "우동"]), sushi)).toBe(true);
  });

  // 이 규칙이 이 기능의 핵심이다
  it("메뉴 하나만 걸린 집은 남긴다", () => {
    const 한식집 = place("종로김밥", ["김밥", "라면", "초밥", "돈까스", "제육덮밥"]);
    expect(isDisliked(한식집, sushi)).toBe(false);
  });

  it("메뉴 과반이 걸리면 뺀다", () => {
    const 초밥집 = place("바다상회", ["모둠초밥", "특초밥", "초밥세트", "우동", "계란찜"]);
    expect(isDisliked(초밥집, sushi)).toBe(true);
  });

  it("딱 절반은 남긴다 — 과반이어야 뺀다", () => {
    const 반반 = place("바다상회", ["모둠초밥", "특초밥", "우동", "돈까스"]);
    expect(isDisliked(반반, sushi)).toBe(false);
  });

  it("메뉴가 없으면 이름으로만 판단한다", () => {
    expect(isDisliked(place("김가네", []), sushi)).toBe(false);
    expect(isDisliked(place("스시로", []), sushi)).toBe(true);
  });

  it("띄어쓰기가 달라도 걸린다", () => {
    const pho = dislikeKeywords({ presets: ["pho"], custom: [] });
    // 이름이 띄어져 있어도 정규화되어 걸린다
    expect(isDisliked(place("사이공 쌀 국수", ["볶음밥"]), pho)).toBe(true);
    // 메뉴 쪽도 마찬가지 — 5개 중 3개면 과반이다
    expect(
      isDisliked(place("반포식당", ["소고기 쌀 국수", "해물 쌀국수", "차돌쌀국수", "볶음밥", "짜조"]), pho),
    ).toBe(true);
    // 같은 집이라도 쌀국수가 하나뿐이면 남는다
    expect(
      isDisliked(place("반포식당", ["소고기 쌀 국수", "제육덮밥", "김치찌개", "볶음밥", "짜조"]), pho),
    ).toBe(false);
  });

  it("프리셋 키워드는 짧은 조각을 쓰지 않는다", () => {
    // "회" 한 글자가 있으면 회사·회관까지 걸려 멀쩡한 가게가 사라진다
    for (const p of DISLIKE_PRESETS) {
      for (const w of p.keywords) expect(w.length).toBeGreaterThanOrEqual(2);
    }
  });
});
