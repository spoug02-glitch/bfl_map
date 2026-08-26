import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlacePanel from "@/components/PlacePanel";
import { CENTER, type Restaurant } from "@/lib/constants";
import { haversineKm } from "@/lib/geo";

// 상세 패널은 메뉴를 fetch 하지만 SSR 렌더에서는 effect 가 돌지 않는다.
// 그래도 모듈이 fetch 를 참조하므로 정의만 해 둔다.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

// 2026-08-26 라이브에서 실제로 어긋났던 그 가게.
const CU: Restaurant = {
  kakao_place_id: "26338954",
  name: "CU 방학신동아점",
  category: "체인화 편의점",
  address: "서울 도봉구 방학동",
  phone: "",
  kakao_url: "https://place.map.kakao.com/26338954",
  lat: 37.6603985209376,
  lng: 127.024289419043,
  distance_km: 2.35,
} as Restaurant;

function render(distKm: (r: Restaurant) => number) {
  return renderToStaticMarkup(
    createElement(PlacePanel, {
      restaurant: CU,
      entryContext: "list" as const,
      user: null,
      saved: false,
      distKm,
      onToggleSaved: () => {},
      onClose: () => {},
    }),
  );
}

describe("가게 상세의 거리", () => {
  // 이 테스트가 이 파일의 존재 이유다. 수집기가 회사 기준으로 구워둔 distance_km 을
  // 상세가 그대로 그리는 바람에, 지도를 눌러 기준점을 옮기면 같은 가게를 목록은
  // "16m", 상세는 "2.35km" 라고 불렀다.
  it("기준점을 옮기면 그 지점 기준으로 말한다", () => {
    // 가게 바로 앞(약 16m)에 기준점을 찍은 상태
    const nearby = { lat: 37.660392, lng: 127.024107 };
    const html = render(r => haversineKm(nearby, r));

    expect(html).toContain("16m");
    expect(html).not.toContain("2.35km");
    expect(html).not.toContain("2.4km");
  });

  it("기준점이 회사면 수집기 값과 같은 거리를 말한다", () => {
    const html = render(r => (r.lat === CU.lat ? r.distance_km : haversineKm(CENTER, r)));
    expect(html).toContain("2.4km");
    expect(html).not.toContain("16m");
  });

  // 목록은 formatDistance 를 쓰는데 상세만 raw 를 그려서, 기준점이 회사일 때조차
  // 목록 "2.4km" / 상세 "2.35km" 로 어긋나 있었다.
  it("목록과 같은 포맷으로 말한다", () => {
    const html = render(() => 0.016);
    expect(html).toContain("16m");
    expect(html).not.toContain("0.02km");
    expect(html).not.toContain("0.016");
  });
});
