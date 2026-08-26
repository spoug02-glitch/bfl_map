import JsonLd from "@/components/JsonLd";
import MapApp from "@/components/MapApp";
import { SERVICE } from "@/lib/constants";
import { pageMetadata } from "@/lib/page-meta";
import { siteJsonLd } from "@/lib/structured-data";

// 지도는 필터·좌표가 쿼리로 붙는데 그건 전부 같은 문서다. 정식 주소를 못박아 두지
// 않으면 검색엔진이 쿼리별로 다른 페이지로 세어 색인이 쪼개진다. 이 규칙이 필요한
// 곳은 지도 경로 하나이며, 루트 레이아웃에 두면 안내 페이지까지 홈의 중복이 된다.
export const metadata = pageMetadata({
  path: "/",
  title: SERVICE.name,
  description: SERVICE.description,
});

// 서버 컴포넌트로 두어 이 경로가 정적으로 남게 한다. 가게별 OG 태그가 필요한
// 공유 링크는 /place/[id]가 담당한다 — 여기에 searchParams를 읽는 메타데이터를
// 붙이면 지도 첫 화면 전체가 매 요청 서버 렌더로 바뀐다.
export default function Home() {
  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <MapApp />
    </>
  );
}
