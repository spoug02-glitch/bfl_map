"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { CENTER, OFFICE_LABEL, Restaurant } from "@/lib/constants";

/** Kakao zoom: smaller is closer. 3이면 기본 반경 100m 원이 화면을 채운다 —
 *  처음 마주치는 화면과 회사 버튼이 돌아오는 화면 둘 다 이 눈높이다. */
const INITIAL_LEVEL = 3;

/**
 * 식당 마커. 카카오 기본 물방울 핀은 34px짜리라 100곳만 넘어가도 지도가 핀으로
 * 덮인다 — 여기서 필요한 건 "가게가 있다"는 점 하나지, 핀 그림이 아니다.
 */
const DOT_ICON =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14">' +
      '<circle cx="7" cy="7" r="4.5" fill="#2563eb" stroke="#fff" stroke-width="2"/></svg>',
  );

/** 뭉친 자리를 나타내는 원. 필터 칩과 같은 ink라 지도 위에서 우리 것으로 읽힌다. */
const CLUSTER_STYLE = {
  width: "34px",
  height: "34px",
  background: "rgba(4, 22, 39, 0.85)",
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
  setLevel(level: number): void;
}
type KakaoMarker = object;
interface KakaoCircle { setMap(map: KakaoMap | null): void }
interface KakaoClusterer {
  clear(): void;
  addMarkers(markers: KakaoMarker[]): void;
}
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
    fillColor: string; fillOpacity: number;
  }) => KakaoCircle;
  MarkerClusterer: new (opts: {
    map: KakaoMap; averageCenter: boolean; minLevel: number;
    gridSize?: number; disableClickZoom?: boolean;
    styles?: Record<string, string>[];
  }) => KakaoClusterer;
  event: { addListener(target: KakaoMarker, type: string, handler: () => void): void };
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
  onSelect: (r: Restaurant) => void;
  /** 회사로 돌아가기를 지도 밖(떠 있는 버튼)에서 부를 수 있게 열어준다. */
  apiRef?: React.RefObject<MapApi | null>;
};

export default function MapView({ restaurants, maxDist, onSelect, apiRef }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const clustererRef = useRef<KakaoClusterer | null>(null);
  const circleRef = useRef<KakaoCircle | null>(null);
  const [ready, setReady] = useState(false);

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
      // 196곳이 196개 핀으로 깔렸다. 1로 내려 모든 줌에서 켜두고, 실제로 뭉칠지는
      // gridSize가 정한다 — 화면에서 60px 안에 겹친 것만 하나로 모으므로 가까이
      // 당기면 알아서 풀린다.
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 1, gridSize: 32,
        styles: [CLUSTER_STYLE],
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
      window.kakao.maps.event.addListener(office, "click", recenter);
      if (apiRef) apiRef.current = { recenter };
      setReady(true);
    });
  };

  useEffect(() => {
    // ready=true는 initMap이 mapRef/clustererRef를 채운 뒤에만 set되므로 non-null 단언이 안전하다.
    if (!ready || !mapRef.current || !clustererRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    if (circleRef.current) circleRef.current.setMap(null);
    circleRef.current = new kakao.maps.Circle({
      map,
      center: new kakao.maps.LatLng(CENTER.lat, CENTER.lng),
      radius: maxDist * 1000,
      strokeWeight: 2, strokeColor: "#2563eb", strokeOpacity: 0.6,
      fillColor: "#2563eb", fillOpacity: 0.06,
    });
    // 점 아이콘은 마커마다 새로 만들 필요가 없다 — 5,834개면 그 비용이 그대로 쌓인다.
    const dot = new kakao.maps.MarkerImage(
      DOT_ICON,
      new kakao.maps.Size(14, 14),
      // 물방울과 달리 점은 뾰족한 끝이 없어 한가운데를 좌표에 맞춘다
      { offset: new kakao.maps.Point(7, 7) },
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
  }, [ready, restaurants, maxDist, onSelect]);

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
