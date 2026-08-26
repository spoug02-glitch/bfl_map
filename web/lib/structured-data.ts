import { CATEGORY_GROUPS, SERVICE, SITE_URL } from "@/lib/constants";
import type { PlaceIndexEntry } from "@/lib/place-index";

type Node = Record<string, unknown>;
type Graph = { "@context": string; "@graph": Node[] };

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/**
 * 업종 → schema.org 타입. 여기 없는 업종은 전부 Restaurant으로 본다 —
 * restaurants.json의 업종은 zeropay의 BIZ_TYPE 라벨이고 새 값이 언제든 들어온다.
 *
 * CATEGORY_GROUPS의 "카페·빵"을 그대로 쓸 수 없어 두 줄로 나눠 적었다. 빵집을
 * CafeOrCoffeeShop이라고 하면 타입이 틀린다.
 */
const SCHEMA_TYPE = new Map<string, string>([
  ["체인화 편의점", "ConvenienceStore"],
  ["커피 전문점", "CafeOrCoffeeShop"],
  ["제과점업", "Bakery"],
]);

/** 업종 → 요리 종류("한식 일반 음식점업" → "한식"). CATEGORY_GROUPS를 뒤집은 것이다. */
const CUISINE = new Map<string, string>(
  Object.entries(CATEGORY_GROUPS).flatMap(([group, categories]) =>
    categories.map((category) => [category, group] as [string, string]),
  ),
);

function placeUrl(id: string): string {
  return `${SITE_URL}/place/${encodeURIComponent(id)}`;
}

/**
 * 홈에 붙는 사이트 수준 그래프.
 *
 * SearchAction은 넣지 않는다. 이 앱의 검색은 URL에 남지 않아(`?q=` 같은 파라미터가
 * 없다) 검색 결과 주소를 만들 수 없고, 없는 주소를 구조화 데이터로 주장하면 거짓이 된다.
 * 화면 검색이 주소를 갖게 되는 날 여기에 추가할 것.
 */
export function siteJsonLd(): Graph {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SERVICE.name,
        url: `${SITE_URL}/`,
        inLanguage: "ko-KR",
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: SERVICE.name,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
      },
    ],
  };
}

/**
 * 가게 페이지에 붙는 그래프.
 *
 * 이게 있어야 사이트맵에 가게 주소를 넣는 판단이 성립한다. 5,826개 페이지의 <body>는
 * 전부 같은 지도 셸이라 본문만으로는 서로 구별되지 않는다. 상호·주소·좌표·전화·업종을
 * 구조화 데이터로 내보내야 검색엔진이 그 페이지를 무엇으로 다룰지 판단할 근거가 생긴다.
 *
 * 별점·가격대·영업시간은 넣지 않는다. 빌드 시점에 검증된 값이 없고, 구조화 데이터에
 * 없는 값을 적는 것은 구글이 수동 조치 사유로 보는 항목이다.
 */
export function placeJsonLd(id: string, place: PlaceIndexEntry): Graph {
  const url = placeUrl(id);
  const type = SCHEMA_TYPE.get(place.category) ?? "Restaurant";
  const business: Node = {
    "@type": type,
    name: place.name,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address,
      addressCountry: "KR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: place.lat,
      longitude: place.lng,
    },
    telephone: place.phone,
    // 카카오맵의 같은 자리. restaurants.json의 kakao_url은 http로 저장돼 있는데 그
    // 호스트가 https로 308 리다이렉트하므로 최종 주소를 적는다.
    sameAs: [`https://place.map.kakao.com/${encodeURIComponent(id)}`],
  };

  // servesCuisine은 Restaurant의 속성이다. 카페·편의점에 붙이면 타입 위반이고,
  // 모르는 업종이면 지어내지 않고 뺀다.
  const cuisine = type === "Restaurant" ? CUISINE.get(place.category) : undefined;
  if (cuisine) business.servesCuisine = cuisine;

  return {
    "@context": "https://schema.org",
    "@graph": [
      business,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SERVICE.name, item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: place.name, item: url },
        ],
      },
    ],
  };
}
