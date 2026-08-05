"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { CENTER, Restaurant } from "@/lib/constants";
import type { LatLng } from "@/lib/geo";

/** Kakao zoom: smaller is closer. 4 ≈ the office block and its immediate street. */
const INITIAL_LEVEL = 4;

// 카카오맵 JS SDK는 공식 @types 패키지가 없다 — 이 컴포넌트가 실제로 쓰는
// 부분만 최소한으로 타입을 선언해 `any` 없이 사용한다.
interface KakaoLatLng { getLat(): number; getLng(): number }
type KakaoMap = object;
interface KakaoMarker { setMap(map: KakaoMap | null): void }
/** 지도 클릭 리스너가 받는 이벤트. 찍은 좌표만 쓴다. */
interface KakaoMouseEvent { latLng: KakaoLatLng }
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
  event: {
    addListener(target: KakaoMarker, type: "click", handler: () => void): void;
    addListener(target: KakaoMap, type: "click", handler: (e: KakaoMouseEvent) => void): void;
  };
}

declare global {
  interface Window {
    kakao: { maps: KakaoMapsNamespace };
  }
}

type Props = {
  restaurants: Restaurant[];
  maxDist: number;
  /** 반경 원과 거리 계산의 기준점. 지도를 찍으면 여기가 옮겨간다. */
  origin: LatLng;
  onSelect: (r: Restaurant) => void;
  onPickOrigin: (p: LatLng) => void;
};

export default function MapView({ restaurants, maxDist, origin, onSelect, onPickOrigin }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const clustererRef = useRef<KakaoClusterer | null>(null);
  const circleRef = useRef<KakaoCircle | null>(null);
  const originMarkerRef = useRef<KakaoMarker | null>(null);
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
      const map = new window.kakao.maps.Map(mapEl.current, {
        center: new window.kakao.maps.LatLng(CENTER.lat, CENTER.lng),
        // Open tight on the office block. Lunch starts with "what is right
        // here", and the radius slider is there for widening out.
        level: INITIAL_LEVEL,
      });
      mapRef.current = map;
      clustererRef.current = new window.kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 5,
      });
      new window.kakao.maps.Marker({
        map,
        position: new window.kakao.maps.LatLng(CENTER.lat, CENTER.lng),
        title: "창동씨드큐브",
      });
      window.kakao.maps.event.addListener(map, "click", (e: KakaoMouseEvent) => {
        onPickOriginRef.current({ lat: e.latLng.getLat(), lng: e.latLng.getLng() });
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
      center: new kakao.maps.LatLng(origin.lat, origin.lng),
      radius: maxDist * 1000,
      strokeWeight: 2, strokeColor: "#2563eb", strokeOpacity: 0.6,
      fillColor: "#2563eb", fillOpacity: 0.06,
    });
    // 회사가 아닌 곳을 찍었을 때만 기준점 핀을 세운다. 회사에는 이미 핀이 있다.
    if (originMarkerRef.current) originMarkerRef.current.setMap(null);
    originMarkerRef.current = null;
    if (origin.lat !== CENTER.lat || origin.lng !== CENTER.lng) {
      originMarkerRef.current = new kakao.maps.Marker({
        map,
        position: new kakao.maps.LatLng(origin.lat, origin.lng),
        title: "선택한 지점",
      });
    }
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
  }, [ready, restaurants, maxDist, origin, onSelect]);

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
