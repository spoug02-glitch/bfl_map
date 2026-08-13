import MapApp from "@/components/MapApp";

// 서버 컴포넌트로 두어 이 경로가 정적으로 남게 한다. 가게별 OG 태그가 필요한
// 공유 링크는 /place/[id]가 담당한다 — 여기에 searchParams를 읽는 메타데이터를
// 붙이면 지도 첫 화면 전체가 매 요청 서버 렌더로 바뀐다.
export default function Home() {
  return <MapApp />;
}
