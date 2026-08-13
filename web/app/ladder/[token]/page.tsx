import type { Metadata } from "next";
import RouletteResult from "@/components/RouletteResult";
import { OG_CARD_PATH } from "@/lib/constants";
import { decodeLadder } from "@/lib/ladder-link";
import type { ShareSubject } from "@/lib/share-copy";
import shareIndex from "@/lib/share-index.json";

// 룰렛 결과는 DB에 없다 — 링크 자체가 결과다. 그래서 이 페이지는 토큰만 풀면
// 되고, 서버가 조회할 것도 만료시킬 것도 없다.

const index = shareIndex as Record<string, ShareSubject>;
const SITE_NAME = "직장인 맛창고";

type Props = { params: Promise<{ token: string }> };

/** 색인에 없는 id는 조용히 넘긴다 — 수집을 다시 돌려 사라진 가게일 수 있다. */
function nameOf(placeId: string): string | null {
  return Object.hasOwn(index, placeId) ? index[placeId].name : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const draw = decodeLadder(token);
  const winner = draw ? nameOf(draw.placeIds[draw.winner]) : null;
  if (!draw || !winner) {
    return { title: SITE_NAME, description: "창동씨드큐브 반경 5km 비플페이(제로페이) 맛집 지도" };
  }
  const title = `오늘 점심은 ${winner}`;
  const description = `후보 ${draw.placeIds.length}곳 중에 룰렛으로 정했어요`;
  return {
    title,
    description,
    openGraph: {
      title, description, siteName: SITE_NAME, type: "website", locale: "ko_KR",
      images: [{ url: OG_CARD_PATH, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_CARD_PATH] },
  };
}

export default async function LadderPage({ params }: Props) {
  const { token } = await params;
  return <RouletteResult draw={decodeLadder(token)} />;
}
