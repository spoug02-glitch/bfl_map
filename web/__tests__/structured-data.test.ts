import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/constants";
import type { PlaceIndexEntry } from "@/lib/place-index";
import { placeJsonLd, siteJsonLd } from "@/lib/structured-data";

function entry(over: Partial<PlaceIndexEntry> = {}): PlaceIndexEntry {
  return {
    name: "오스시",
    category: "일식 음식점업",
    distance_km: 0.01,
    address: "서울 도봉구 마들로13길 61",
    lat: 37.654540380514,
    lng: 127.049925837294,
    phone: "0234931121",
    ...over,
  };
}

/** @graph 안에서 주어진 @type을 가진 노드 하나. 없으면 그 자리에서 실패시킨다. */
function node(graph: { "@graph": Record<string, unknown>[] }, type: string) {
  const found = graph["@graph"].find((n) => n["@type"] === type);
  if (!found) throw new Error(`@type ${type} 이 그래프에 없다`);
  return found;
}

/** 그 타입의 노드가 아예 없어야 할 때. */
function hasNode(graph: { "@graph": Record<string, unknown>[] }, type: string) {
  return graph["@graph"].some((n) => n["@type"] === type);
}

describe("siteJsonLd", () => {
  it("WebSite와 Organization을 한 그래프에 담는다", () => {
    const g = siteJsonLd();
    expect(g["@context"]).toBe("https://schema.org");
    expect(hasNode(g, "WebSite")).toBe(true);
    expect(hasNode(g, "Organization")).toBe(true);
  });

  it("WebSite의 주소는 정식 도메인이다", () => {
    expect(node(siteJsonLd(), "WebSite").url).toBe(`${SITE_URL}/`);
  });

  // 이 앱의 검색은 URL에 남지 않는다(`?q=` 같은 파라미터가 없다). 검색 결과 주소를
  // 만들 수 없는데 SearchAction을 선언하면 구조화 데이터로 거짓을 말하는 셈이다.
  it("검색 URL이 없으므로 SearchAction을 넣지 않는다", () => {
    expect(JSON.stringify(siteJsonLd())).not.toContain("SearchAction");
  });
});

describe("placeJsonLd - 업종별 타입", () => {
  it.each([
    ["한식 일반 음식점업", "Restaurant"],
    ["체인화 편의점", "ConvenienceStore"],
    ["커피 전문점", "CafeOrCoffeeShop"],
    ["제과점업", "Bakery"],
  ])("%s 는 %s 다", (category, type) => {
    expect(hasNode(placeJsonLd("1", entry({ category })), type)).toBe(true);
  });

  it.each([
    ["한식 일반 음식점업", "한식"],
    ["중식 음식점업", "중식"],
    ["일식 음식점업", "일식"],
    ["치킨 전문점", "치킨"],
  ])("%s 에는 servesCuisine %s 가 붙는다", (category, cuisine) => {
    const g = placeJsonLd("1", entry({ category }));
    expect(node(g, "Restaurant").servesCuisine).toBe(cuisine);
  });

  // servesCuisine은 Restaurant의 속성이다. 편의점·카페에 붙이면 타입 위반이다.
  it("편의점에는 servesCuisine을 붙이지 않는다", () => {
    const g = placeJsonLd("1", entry({ category: "체인화 편의점" }));
    expect(node(g, "ConvenienceStore")).not.toHaveProperty("servesCuisine");
  });

  // 업종 목록에 없는 값이 들어와도 Restaurant으로 떨어지되 cuisine은 지어내지 않는다.
  it("모르는 업종은 servesCuisine 없이 Restaurant으로 떨어진다", () => {
    const g = placeJsonLd("1", entry({ category: "그 밖의 무슨 업종" }));
    expect(node(g, "Restaurant")).not.toHaveProperty("servesCuisine");
  });
});

describe("placeJsonLd - 내용", () => {
  const graph = placeJsonLd("524535584", entry());
  const biz = node(graph, "Restaurant");

  it("상호·주소·좌표·전화를 담는다", () => {
    expect(biz.name).toBe("오스시");
    expect(biz.address).toMatchObject({
      "@type": "PostalAddress",
      streetAddress: "서울 도봉구 마들로13길 61",
      addressCountry: "KR",
    });
    expect(biz.geo).toMatchObject({
      "@type": "GeoCoordinates",
      latitude: 37.654540380514,
      longitude: 127.049925837294,
    });
    expect(biz.telephone).toBe("0234931121");
  });

  it("url은 그 가게의 절대주소다", () => {
    expect(biz.url).toBe(`${SITE_URL}/place/524535584`);
  });

  it("sameAs로 카카오맵 자리를 가리킨다", () => {
    expect(biz.sameAs).toContain("https://place.map.kakao.com/524535584");
  });

  // 리뷰 수·가격대·영업시간은 빌드 시점에 검증된 값이 없다. 없는 걸 넣으면
  // 구조화 데이터가 거짓이 되고, 구글은 그걸 수동 조치 사유로 본다.
  it.each(["aggregateRating", "priceRange", "openingHours", "review"])(
    "검증되지 않은 %s 는 넣지 않는다",
    (prop) => {
      expect(JSON.stringify(graph)).not.toContain(prop);
    },
  );

  it("BreadcrumbList가 홈 다음에 가게를 둔다", () => {
    const crumbs = node(graph, "BreadcrumbList");
    expect(crumbs.itemListElement).toMatchObject([
      { position: 1, item: `${SITE_URL}/` },
      { position: 2, name: "오스시", item: `${SITE_URL}/place/524535584` },
    ]);
  });

  // 경로 파라미터는 누구나 아무 값이나 넣는다. 그대로 이어붙이면 JSON-LD의 url이
  // 남의 주소를 가리키게 만들 수 있다.
  it("id를 URL에 넣기 전에 인코딩한다", () => {
    const g = placeJsonLd("1 2", entry());
    expect(node(g, "Restaurant").url).toBe(`${SITE_URL}/place/1%202`);
  });
});
