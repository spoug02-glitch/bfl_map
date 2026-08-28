import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import MapApp from "@/components/MapApp";
import { SERVICE } from "@/lib/constants";
import { pageMetadata } from "@/lib/page-meta";
import { lookupPlace, resolveLegacyPlaceId } from "@/lib/place-index";
import { shareDescription, sharePath, shareTitle } from "@/lib/share-copy";
import { placeJsonLd } from "@/lib/structured-data";

// 공유 링크가 착지하는 경로. 지도는 /와 똑같이 보이지만, 여기만 가게별 OG 태그와
// 구조화 데이터를 달 수 있어서 슬랙·디스코드·카톡이 이름과 대표 메뉴가 담긴 카드를
// 그리고, 검색엔진이 이 페이지를 그 가게로 알아본다.
//
// 5,834건짜리 restaurants.json 대신 얇은 색인만 읽는다 (scripts/build-share-index.mjs).

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // 옛 카카오 id 로 들어온 링크는 새 주소가 정본이다. 메타데이터에서도 같은
  // 판단을 해야 크롤러가 옛 주소를 별도 문서로 세지 않는다.
  const moved = resolveLegacyPlaceId(id);
  const place = lookupPlace(moved ?? id);
  // 색인에 없는 id로 들어와도 화면은 떠야 한다(데이터 갱신으로 사라진 가게).
  // 그럴 땐 앱 기본 카드로 떨어뜨리되, 내용이 홈과 같은 soft 404라 색인에서는 뺀다.
  if (!place) {
    return {
      title: SERVICE.name,
      description: SERVICE.description,
      robots: { index: false },
    };
  }
  return pageMetadata({
    path: sharePath(moved ?? id),
    title: shareTitle(place),
    description: shareDescription(place),
  });
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params;
  // 2026-08-27 전에 뿌려진 /place/<카카오숫자id> 링크. 남의 채팅방에 박혀 있어서
  // 그대로 두면 조용히 soft 404 가 된다 — 308 로 새 주소에 넘긴다.
  const moved = resolveLegacyPlaceId(id);
  if (moved) permanentRedirect(`/place/${moved}`);

  const place = lookupPlace(id);
  return (
    <>
      {place && <JsonLd data={placeJsonLd(id, place)} />}
      <MapApp initialPlaceId={id} />
    </>
  );
}
