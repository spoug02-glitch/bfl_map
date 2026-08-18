import { describe, expect, it } from "vitest";
import { DISLIKE_PRESETS, dislikeKeywords, isDisliked, parseDislikes } from "@/lib/dislikes";
import type { Restaurant } from "@/lib/constants";
import { normalizeQuery } from "@/lib/constants";

function place(name: string): Restaurant {
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

describe("parseDislikes", () => {
  const EMPTY = { presets: [], custom: [] };

  it("고른 것과 적은 것을 읽는다", () => {
    expect(parseDislikes('{"presets":["sushi"],"custom":["고수"]}')).toEqual({
      presets: ["sushi"], custom: ["고수"],
    });
  });

  // 잠깐 있었던 "가게 직접 빼기"(places)가 아직 저장돼 있는 브라우저가 있다
  it("모르는 칸은 조용히 버린다", () => {
    expect(parseDislikes('{"presets":["sushi"],"custom":[],"places":["123"]}')).toEqual({
      presets: ["sushi"], custom: [],
    });
  });

  it("망가진 값에도 앱이 서지 않는다", () => {
    expect(parseDislikes(null)).toEqual(EMPTY);
    expect(parseDislikes("")).toEqual(EMPTY);
    expect(parseDislikes("not json at all")).toEqual(EMPTY);
    expect(parseDislikes("null")).toEqual(EMPTY);
    expect(parseDislikes('"문자열"')).toEqual(EMPTY);
    // 칸마다 따로 본다 — 하나가 망가져도 나머지는 산다
    expect(parseDislikes('{"presets":"sushi","custom":null}')).toEqual(EMPTY);
    // 배열 안의 이물질만 걸러낸다
    expect(parseDislikes('{"presets":["sushi",7,null],"custom":[]}').presets)
      .toEqual(["sushi"]);
  });
});

describe("isDisliked", () => {
  it("설정이 비어 있으면 아무도 안 뺀다", () => {
    expect(isDisliked(place("오스시"), [])).toBe(false);
  });

  it("가게 이름에 걸리면 뺀다 — 그게 그 집이다", () => {
    expect(isDisliked(place("오스시"), sushi)).toBe(true);
  });

  // 카카오 메뉴 수집이 중단돼 이제 이름으로만 판단한다.
  it("이름에 없으면 남긴다", () => {
    expect(isDisliked(place("김가네"), sushi)).toBe(false);
    expect(isDisliked(place("스시로"), sushi)).toBe(true);
  });

  it("띄어쓰기가 달라도 걸린다", () => {
    const pho = dislikeKeywords({ presets: ["pho"], custom: [] });
    // 이름이 띄어져 있어도 정규화되어 걸린다
    expect(isDisliked(place("사이공 쌀 국수"), pho)).toBe(true);
  });

  it("프리셋 키워드는 짧은 조각을 쓰지 않는다", () => {
    // "회" 한 글자가 있으면 회사·회관까지 걸려 멀쩡한 가게가 사라진다
    for (const p of DISLIKE_PRESETS) {
      for (const w of p.keywords) expect(w.length).toBeGreaterThanOrEqual(2);
    }
  });
});
