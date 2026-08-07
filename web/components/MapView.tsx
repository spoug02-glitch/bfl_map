"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { CENTER, OFFICE_LABEL, Restaurant } from "@/lib/constants";

/** Kakao zoom: smaller is closer. 3이면 기본 반경 100m 원이 화면을 채운다 —
 *  처음 마주치는 화면과 회사 버튼이 돌아오는 화면 둘 다 이 눈높이다. */
const INITIAL_LEVEL = 3;

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
  MarkerClusterer: new (opts: { map: KakaoMap; averageCenter: boolean; minLevel: number }) => KakaoClusterer;
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
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 5,
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
    const markers = restaurants.map(r => {
      const m = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(r.lat, r.lng),
        title: r.name,
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
