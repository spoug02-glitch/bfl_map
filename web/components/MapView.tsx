"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { CENTER, OFFICE_LABEL, Restaurant } from "@/lib/constants";

/** Kakao zoom: smaller is closer. 4 ≈ the office block and its immediate street. */
const INITIAL_LEVEL = 4;

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
interface KakaoMapsNamespace {
  load(cb: () => void): void;
  Map: new (el: HTMLElement | null, opts: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Marker: new (opts: { map?: KakaoMap; position: KakaoLatLng; title?: string }) => KakaoMarker;
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

type Props = {
  restaurants: Restaurant[];
  maxDist: number;
  onSelect: (r: Restaurant) => void;
};

export default function MapView({ restaurants, maxDist, onSelect }: Props) {
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
      const office = new window.kakao.maps.Marker({ map, position: center, title: OFFICE_LABEL });
      // 회사 마커를 누르면 처음 화면으로 돌아온다. 지도를 헤매다 보면 회사가
      // 어디였는지부터 잃어버리는데, 되돌아오는 길이 이 지도엔 없었다.
      window.kakao.maps.event.addListener(office, "click", () => {
        map.setLevel(INITIAL_LEVEL);
        map.panTo(center);
      });
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
