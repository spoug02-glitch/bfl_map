"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { CENTER, OFFICE_LABEL, RADIUS_KM, Restaurant } from "@/lib/constants";
import type { LatLng } from "@/lib/geo";

/**
 * Kakao zoom: 숫자가 작을수록 가깝다. 3에서 기본 반경 200m 원은 지름 400px로
 * 그려진다 — 375px 폭 화면을 좌우로 조금 넘고 세로(435px)로는 들어와, 원이
 * 화면을 꽉 채운다. 한 단계 물러나면 지름이 절반이 되어 화면이 텅 빈다.
 * 처음 마주치는 화면과 회사 버튼이 돌아오는 화면 둘 다 이 눈높이다.
 */
const INITIAL_LEVEL = 3;

/**
 * 지도 위 표시색. 카카오맵 SDK는 색을 문자열 옵션으로 받고 data URI 안에도 들어가서
 * Tailwind 클래스도 var()도 쓸 수 없다 — 그래서 여기만 리터럴이다.
 * 값은 --md-sys-color-primary 와 같아야 한다. 팔레트를 바꾸면 여기도 같이 고칠 것.
 */
const MAP_PRIMARY = "#9b4511";

/**
 * 식당 마커. 카카오 기본 물방울 핀은 34px짜리라 100곳만 넘어가도 지도가 핀으로
 * 덮인다 — 여기서 필요한 건 "가게가 있다"는 점 하나지, 핀 그림이 아니다.
 *
 * 그려지는 점은 14px 그대로지만 그림 자체는 28px다. 카카오 마커는 **이미지 크기가
 * 곧 터치 영역**이라, 14px 그림은 손가락으로 눌러도 자주 빗나가 "눌렀는데 아무
 * 반응이 없다"가 된다(2026-08-21 제보). 나머지를 투명하게 비워 보이는 크기는
 * 유지하면서 누를 수 있는 넓이만 넓혔다. 이 값을 줄이려면 손가락으로 먼저 눌러볼 것.
 */
const DOT_BOX = 28;
const DOT_ICON =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${DOT_BOX}" height="${DOT_BOX}">` +
      `<circle cx="${DOT_BOX / 2}" cy="${DOT_BOX / 2}" r="4.5" fill="${MAP_PRIMARY}" stroke="#fff" stroke-width="2"/></svg>`,
  );

/**
 * 뭉친 자리를 나타내는 원. 필터 칩과 같은 primary라 지도 위에서 우리 것으로 읽힌다.
 *
 * 불투명도 0.85가 하한이다 — 흰 배경 위에서 흰 글자와의 대비가 4.70:1로 WCAG AA를
 * 넘긴다. 0.6이면 2.81:1까지 떨어져 숫자가 안 읽힌다.
 *
 * 예전 남색(ink)일 때는 반대로 0.6이 상한이었다. 0.85로 올리면 지도 위에서 검은 점처럼
 * 튀었기 때문인데, 그 문제는 색이 거의 검정이라서 생긴 것이라 따뜻한 중간 톤인 지금
 * 색(합성하면 rgb(170,97,53))에는 해당하지 않는다.
 */
const CLUSTER_STYLE = {
  width: "34px",
  height: "34px",
  background: "rgba(155, 69, 17, 0.85)",
  borderRadius: "17px",
  color: "#fff",
  textAlign: "center",
  lineHeight: "34px",
  fontSize: "13px",
  fontWeight: "700",
};

// 카카오맵 JS SDK는 공식 @types 패키지가 없다 — 이 컴포넌트가 실제로 쓰는
// 부분만 최소한으로 타입을 선언해 `any` 없이 사용한다.
type KakaoLatLng = object;
interface KakaoMap {
  panTo(pos: KakaoLatLng): void;
  /** 컨테이너 크기가 바뀐 걸 지도에 알린다. 부르지 않으면 늘어난 자리가 비어 있다. */
  relayout(): void;
  getLevel(): number;
  /** anchor를 주면 그 좌표를 붙든 채 확대한다 — 누른 자리가 화면에서 안 튄다. */
  setLevel(level: number, opts?: { anchor: KakaoLatLng }): void;
}
interface KakaoMarker { setMap(map: KakaoMap | null): void }
interface KakaoCircle { setMap(map: KakaoMap | null): void }
/** 지도 클릭 리스너가 받는 이벤트. 찍은 좌표만 쓴다. */
interface KakaoPointOnMap { getLat(): number; getLng(): number }
interface KakaoMouseEvent { latLng: KakaoPointOnMap }
interface KakaoClusterer {
  clear(): void;
  addMarkers(markers: KakaoMarker[]): void;
}
/** clusterclick 핸들러가 받는 뭉치. 누른 자리를 붙들 좌표만 쓴다. */
interface KakaoCluster { getCenter(): KakaoLatLng }
type KakaoSize = object;
type KakaoPoint = object;
type KakaoMarkerImage = object;

interface KakaoMapsNamespace {
  load(cb: () => void): void;
  Map: new (el: HTMLElement | null, opts: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Size: new (w: number, h: number) => KakaoSize;
  Point: new (x: number, y: number) => KakaoPoint;
  MarkerImage: new (src: string, size: KakaoSize, opts?: { offset?: KakaoPoint }) => KakaoMarkerImage;
  Marker: new (opts: {
    map?: KakaoMap; position: KakaoLatLng; title?: string;
    image?: KakaoMarkerImage; zIndex?: number;
  }) => KakaoMarker;
  Circle: new (opts: {
    map: KakaoMap; center: KakaoLatLng; radius: number;
    strokeWeight: number; strokeColor: string; strokeOpacity: number;
    strokeStyle?: string;
    fillColor: string; fillOpacity: number;
  }) => KakaoCircle;
  MarkerClusterer: new (opts: {
    map: KakaoMap; averageCenter: boolean; minLevel: number;
    gridSize?: number; disableClickZoom?: boolean;
    styles?: Record<string, string>[];
  }) => KakaoClusterer;
  event: {
    addListener(
      target: KakaoClusterer, type: "clusterclick", handler: (cluster: KakaoCluster) => void,
    ): void;
    addListener(target: KakaoMarker, type: string, handler: () => void): void;
    addListener(target: KakaoMap, type: "click", handler: (e: KakaoMouseEvent) => void): void;
  };
}

declare global {
  interface Window {
    kakao: { maps: KakaoMapsNamespace };
  }
}

/** 지도에 시키는 일 중 부모가 버튼으로 노출하는 것. */
export type MapApi = { recenter: () => void };

type Props = {
  restaurants: Restaurant[];
  maxDist: number;
  /** 반경 원과 거리 계산의 기준점. 지도를 찍으면 여기가 옮겨간다. */
  origin: LatLng;
  /** URL로 열린 가게. 반경·필터와 무관하게 핀으로 남고, 열릴 때 지도가 그리로 간다. */
  pinned?: Restaurant | null;
  onSelect: (r: Restaurant) => void;
  onPickOrigin: (p: LatLng) => void;
  /** 회사로 돌아가기를 지도 밖(떠 있는 버튼)에서 부를 수 있게 열어준다. */
  apiRef?: React.RefObject<MapApi | null>;
};

export default function MapView({ restaurants, maxDist, origin, pinned, onSelect, onPickOrigin, apiRef }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const clustererRef = useRef<KakaoClusterer | null>(null);
  const circleRef = useRef<KakaoCircle | null>(null);
  const originMarkerRef = useRef<KakaoMarker | null>(null);
  const boundaryRef = useRef<KakaoCircle | null>(null);
  const pinnedMarkerRef = useRef<KakaoMarker | null>(null);
  const [ready, setReady] = useState(false);

  // 클릭 리스너는 지도 생성 시 한 번만 단다. 최신 콜백을 ref로 읽어 리스너를
  // 다시 달지 않는다 — 카카오 SDK에는 removeListener를 걸 훅이 마땅치 않다.
  // 갱신은 렌더가 아니라 effect에서 한다: 렌더 중 ref 쓰기는 동시성 렌더링에서
  // 버려질 수 있는 작업이라 React가 금지한다.
  const onPickOriginRef = useRef(onPickOrigin);
  useEffect(() => {
    onPickOriginRef.current = onPickOrigin;
  }, [onPickOrigin]);

  const initMap = () => {
    window.kakao.maps.load(() => {
      const center = new window.kakao.maps.LatLng(CENTER.lat, CENTER.lng);
      const map = new window.kakao.maps.Map(mapEl.current, {
        center,
        // Open tight on the office block. Lunch starts with "what is right
        // here", and the radius slider is there for widening out.
        level: INITIAL_LEVEL,
      });
      mapRef.current = map;
      // minLevel 5로 두면 한참 축소했을 때만 뭉쳐서, 정작 쓰는 줌(기본 3)에서는
      // 196곳이 196개 핀으로 깔렸다. 낮춰서 쓰는 줌에서도 켜두고, 실제로 뭉칠지는
      // gridSize가 정한다 — 화면에서 32px 안에 겹친 것만 하나로 모으므로 가까이
      // 당기면 알아서 풀린다.
      //
      // disableClickZoom은 켜야 한다. 기본 동작은 "1레벨 확대"가 아니라 "뭉친 마커가
      // 모두 잘 보이도록 레벨과 영역을 변경"이라, 두 곳이 이미 화면에 다 보이는
      // 뭉치는 바꿀 게 없어 **눌러도 아무 일도 일어나지 않는다**(2026-08-21, 2026-08-26
      // 두 번 제보). 2026-08-21에 이걸 minLevel 탓으로 진단해 5에서 2로 내렸지만
      // 원인이 아니었다 — 레벨을 바꿔도 "이미 다 보이면 가만히 있는다"는 그대로다.
      // 공식 문서도 커스텀 핸들러를 쓸 거면 이 값을 켜라고 적어둔다: 끄면 핸들러에
      // cluster 객체가 넘어오지 않을 수 있다.
      // https://apis.map.kakao.com/web/sample/addClustererClickEvent/
      //
      // minLevel이 2인 것은 이제 아래 핸들러와 짝이다. 레벨 1에서는 클러스터가 아예
      // 만들어지지 않으므로(실측: 레벨 2에서 12개 → 레벨 1에서 0개) 눌릴 수 있는
      // 뭉치는 항상 레벨 2 이상에 있고 getLevel()-1은 언제나 유효하다. 1로 내리면
      // 레벨 1의 뭉치가 setLevel(0)을 부르고 카카오가 그걸 1로 되물려, 고친 그
      // 죽은 컨트롤이 되살아난다.
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 2, gridSize: 32,
        disableClickZoom: true,
        styles: [CLUSTER_STYLE],
      });
      // 뭉치를 누르면 한 단계 당긴다 — 카카오 공식 샘플과 같은 처리다. setLevel은
      // 조건 없이 실행되므로 "이미 다 보인다"고 가만히 있는 일이 없다. 뭉치 안을
      // 목록으로 따로 열어주지는 않는다: 클러스터는 목록과 같은 집합(visible)으로
      // 만들어지므로 그 가게들은 이미 주변 목록에 들어 있고, 카카오맵도 네이버도
      // 뭉치를 눌러 목록을 여는 UX를 쓰지 않는다(2026-08-26 확인).
      window.kakao.maps.event.addListener(clustererRef.current, "clusterclick", cluster => {
        map.setLevel(map.getLevel() - 1, { anchor: cluster.getCenter() });
      });
      // 회사는 식당과 같은 파란 핀이면 안 된다 — 핀 수백 개 사이에서 "여기가
      // 어디 기준인지"를 찾을 수 없었다. 우리 로고를 크게, 항상 맨 위에 둔다.
      const office = new window.kakao.maps.Marker({
        map,
        position: center,
        title: OFFICE_LABEL,
        image: new window.kakao.maps.MarkerImage(
          "/office-marker.png",
          new window.kakao.maps.Size(44, 44),
          // 밥그릇 핀의 뾰족한 꼭짓점(viewBox 32,57 → 44px에서 22,39)을 좌표에 앉힌다
          { offset: new window.kakao.maps.Point(22, 39) },
        ),
        zIndex: 10,
      });
      // 처음 화면으로 돌아오는 길. 마커 클릭에도 걸려 있지만, 전국 크기로 빼면
      // 마커는 못 찾는다 — 그래서 같은 동작을 apiRef로도 열어 떠 있는 버튼이 쓴다.
      const recenter = () => {
        map.setLevel(INITIAL_LEVEL);
        map.panTo(center);
      };
      window.kakao.maps.event.addListener(office, "click", () => {
        recenter();
        // 회사로 돌아오기 = 기준점도 회사로. 지도만 돌리고 기준점을 흘리면
        // "회사를 눌렀는데 목록은 딴 동네"가 된다.
        onPickOriginRef.current(CENTER);
      });
      // 지도 빈 곳 탭 = 기준점 이동. 실수 탭 처리(패널이 열려 있으면 닫기만)는
      // 부모의 onPickOrigin 이 한다 — 여기는 좌표만 넘긴다.
      window.kakao.maps.event.addListener(map, "click", (e: KakaoMouseEvent) => {
        onPickOriginRef.current({ lat: e.latLng.getLat(), lng: e.latLng.getLng() });
      });
      if (apiRef) apiRef.current = { recenter };
      setReady(true);
    });
  };

  // 컨테이너 크기가 바뀌면 카카오에 relayout()으로 알린다 — SDK 문서가 요구하는
  // 계약이다. 창 리사이즈는 SDK가 스스로 처리하는 걸 확인했지만(2026-08-26
  // Playwright 실측: relayout 없는 배포본도 창 확대에 타일을 다시 채움), 창은
  // 그대로인 채 이 컨테이너만 커지는 경우는 그 처리 밖이다. 이 앱에 그게 있다:
  // 필터 바 접기가 지도를 128px 키운다. 지금은 타일 버퍼(256px)가 우연히 흡수해
  // 흰 띠가 안 보이는데, 그건 문서화되지 않은 여유에 기대는 것이라 버퍼보다 큰
  // 레이아웃 변화가 생기는 순간 깨진다. 계약대로 알려주는 쪽이 맞다.
  //
  // 즉시 한 번, 다음 프레임에 한 번 더 부른다. 리사이즈가 여러 프레임에 걸쳐
  // 정착할 때 콜백 시점의 크기가 최종이 아닐 수 있어 rAF로 마무리하고, 그려지지
  // 않는 탭에서는 rAF가 발화하지 않으므로 즉시 호출이 기본 채움을 맡는다.
  // relayout은 멱등이라 두 번 불러도 비용뿐 부작용이 없다.
  useEffect(() => {
    if (!ready || !mapEl.current) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      mapRef.current?.relayout();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mapRef.current?.relayout());
    });
    ro.observe(mapEl.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [ready]);

  // URL로 열린 가게의 핀. 반경을 그 가게까지 넓히던 방식을 대체한다 — 가게
  // 하나를 살리려고 수천 곳을 목록에 쏟아붓는 대신, 그 하나만 예외로 남긴다.
  // 상세를 닫아도 핀은 남아 공유받은 가게를 다시 찾을 수 있다.
  //
  // 이미 점으로 그려진 가게면 핀을 겹쳐 그리지 않는다. 반경·필터 안에 든
  // 가게라는 뜻이라 평범한 점 하나로 충분하고, 겹치면 같은 자리에 점과 핀이
  // 두 겹으로 떠서 다른 가게처럼 읽힌다. 카카오 기본 물방울 마커를 그대로
  // 쓴다 — 점(음식점)·로고(회사)와 한눈에 구별되는 세 번째 모양이 필요할
  // 뿐이고, "지도에 꽂힌 핀"은 그 자체로 공유받은 자리라고 읽힌다.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const kakao = window.kakao;
    if (pinnedMarkerRef.current) pinnedMarkerRef.current.setMap(null);
    pinnedMarkerRef.current = null;
    if (!pinned) return;
    if (restaurants.some(r => r.kakao_place_id === pinned.kakao_place_id)) return;
    const m = new kakao.maps.Marker({
      map: mapRef.current,
      position: new kakao.maps.LatLng(pinned.lat, pinned.lng),
      title: pinned.name,
      // 회사 로고(10)보다는 아래, 음식점 점들보다는 위.
      zIndex: 9,
    });
    kakao.maps.event.addListener(m, "click", () => onSelect(pinned));
    pinnedMarkerRef.current = m;
  }, [ready, pinned, restaurants, onSelect]);

  // 핀이 꽂히면 지도가 그리로 간다. 공유 링크의 가게는 기본 화면(회사 근처)
  // 밖일 수 있는데, 여기로 데려다주지 않으면 핀도 반경 원도 화면 밖이라 상세를
  // 닫는 순간 빈 지도처럼 보인다. 필터 변경으로 이 effect가 다시 돌지 않도록
  // 의존성은 핀 자체만 둔다 — 같은 가게면 all에서 온 같은 객체라 재실행이 없다.
  useEffect(() => {
    if (!ready || !mapRef.current || !pinned) return;
    mapRef.current.panTo(new window.kakao.maps.LatLng(pinned.lat, pinned.lng));
  }, [ready, pinned]);

  // 반경 원·기준점 핀·수집 경계. 마커와 갱신 주기가 달라 effect를 가른다 —
  // 기준점만 옮겼는데 5,800개 마커를 다시 만들 이유가 없다.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    const moved = origin.lat !== CENTER.lat || origin.lng !== CENTER.lng;

    if (circleRef.current) circleRef.current.setMap(null);
    circleRef.current = new kakao.maps.Circle({
      map,
      center: new kakao.maps.LatLng(origin.lat, origin.lng),
      radius: maxDist * 1000,
      strokeWeight: 2, strokeColor: MAP_PRIMARY, strokeOpacity: 0.6,
      fillColor: MAP_PRIMARY, fillOpacity: 0.06,
    });

    // 회사가 아닌 곳을 찍었을 때만 기준점 핀을 세운다. 회사에는 이미 로고 핀이 있다.
    if (originMarkerRef.current) originMarkerRef.current.setMap(null);
    originMarkerRef.current = null;
    // 수집 경계: 데이터는 회사 5km 안에서만 모았다. 기준점이 밖을 향하면 지도가
    // 비어 "가게가 없다"로 읽힌다 — 없는 게 아니라 모르는 곳이라는 걸 선으로 긋는다.
    if (boundaryRef.current) boundaryRef.current.setMap(null);
    boundaryRef.current = null;
    if (moved) {
      originMarkerRef.current = new kakao.maps.Marker({
        map,
        position: new kakao.maps.LatLng(origin.lat, origin.lng),
        title: "선택한 지점",
      });
      boundaryRef.current = new kakao.maps.Circle({
        map,
        center: new kakao.maps.LatLng(CENTER.lat, CENTER.lng),
        radius: RADIUS_KM * 1000,
        strokeWeight: 1.5, strokeColor: MAP_PRIMARY, strokeOpacity: 0.35,
        strokeStyle: "shortdash",
        fillColor: MAP_PRIMARY, fillOpacity: 0,
      });
    }
  }, [ready, origin, maxDist]);

  useEffect(() => {
    // ready=true는 initMap이 mapRef/clustererRef를 채운 뒤에만 set되므로 non-null 단언이 안전하다.
    if (!ready || !mapRef.current || !clustererRef.current) return;
    const kakao = window.kakao;
    const clusterer = clustererRef.current;
    // 점 아이콘은 마커마다 새로 만들 필요가 없다 — 5,834개면 그 비용이 그대로 쌓인다.
    const dot = new kakao.maps.MarkerImage(
      DOT_ICON,
      new kakao.maps.Size(DOT_BOX, DOT_BOX),
      // 물방울과 달리 점은 뾰족한 끝이 없어 한가운데를 좌표에 맞춘다
      { offset: new kakao.maps.Point(DOT_BOX / 2, DOT_BOX / 2) },
    );
    const markers = restaurants.map(r => {
      const m = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(r.lat, r.lng),
        title: r.name,
        image: dot,
      });
      kakao.maps.event.addListener(m, "click", () => onSelect(r));
      return m;
    });
    clusterer.clear();
    clusterer.addMarkers(markers);
    return () => clusterer.clear();
  }, [ready, restaurants, onSelect]);

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&autoload=false&libraries=clusterer`}
        onLoad={initMap}
      />
      <div ref={mapEl} className="h-full w-full" />
    </>
  );
}
