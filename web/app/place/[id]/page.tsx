import type { Metadata } from "next";
import MapApp from "@/components/MapApp";
import { OG_CARD_PATH, PLACE_ID_RE } from "@/lib/constants";
import { shareDescription, shareTitle, type ShareSubject } from "@/lib/share-copy";
import shareIndex from "@/lib/share-index.json";

// 공유 링크가 착지하는 경로. 지도는 /와 똑같이 보이지만, 여기만 가게별 OG 태그를
// 달 수 있어서 슬랙·디스코드·카톡이 이름과 대표 메뉴가 담긴 카드를 그린다.
//
// 5,834건짜리 restaurants.json 대신 얇은 색인만 읽는다 (scripts/build-share-index.mjs).

const index = shareIndex as Record<string, ShareSubject>;

const SITE_NAME = "직장인 맛집지도";

type Props = { params: Promise<{ id: string }> };

/**
 * 경로 파라미터는 누구나 아무 값이나 넣을 수 있다. 평범한 객체 조회는 `__proto__`나
 * `constructor` 같은 상속 키에 걸려 "없는 가게"인데도 객체/함수를 돌려주고, 그러면
 * 아래 fallback을 그냥 지나쳐 메타데이터 생성이 터진다. 형식 검사와 자기 키 검사를
 * 둘 다 통과한 것만 조회한다.
 */
function lookupPlace(id: string): ShareSubject | undefined {
  if (!PLACE_ID_RE.test(id)) return undefined;
  return Object.hasOwn(index, id) ? index[id] : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const place = lookupPlace(id);
  // 색인에 없는 id로 들어와도 화면은 떠야 한다(데이터 갱신으로 사라진 가게).
  // 그럴 땐 앱 기본 카드로 떨어뜨린다.
  if (!place) {
    return {
      title: SITE_NAME,
      description: "창동씨드큐브 반경 5km 비플페이(제로페이) 맛집 지도",
    };
  }
  const title = shareTitle(place);
  const description = shareDescription(place);
  // openGraph는 부모(layout)와 깊게 합쳐지지 않는다 — 여기서 다시 쓰면 레이아웃이
  // 지정한 이미지가 통째로 사라지므로 카드 이미지를 함께 넣어준다.
  const images = [{ url: OG_CARD_PATH, width: 1200, height: 630 }];
  return {
    title,
    description,
    openGraph: { title, description, siteName: SITE_NAME, type: "website", locale: "ko_KR", images },
    twitter: { card: "summary_large_image", title, description, images: [OG_CARD_PATH] },
  };
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params;
  return <MapApp initialPlaceId={id} />;
}
