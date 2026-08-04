import type { Metadata } from "next";
import MapApp from "@/components/MapApp";
import { shareDescription, shareTitle, type ShareSubject } from "@/lib/share-copy";
import shareIndex from "@/lib/share-index.json";

// 공유 링크가 착지하는 경로. 지도는 /와 똑같이 보이지만, 여기만 가게별 OG 태그를
// 달 수 있어서 슬랙·디스코드·카톡이 이름과 대표 메뉴가 담긴 카드를 그린다.
//
// 5,834건짜리 restaurants.json 대신 얇은 색인만 읽는다 (scripts/build-share-index.mjs).

const index = shareIndex as Record<string, ShareSubject>;

const SITE_NAME = "직장인 맛집지도";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const place = index[id];
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
  return {
    title,
    description,
    openGraph: { title, description, siteName: SITE_NAME, type: "website", locale: "ko_KR" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params;
  return <MapApp initialPlaceId={id} />;
}
