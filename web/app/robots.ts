import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// restaurants.json은 5,834곳 전체(이름·주소·전화번호·좌표·메뉴)를 한 번의 요청으로
// 통째로 내려주는 정적 파일이다. 악성 스크레이퍼는 robots.txt를 지키지 않으므로
// 이건 막는다기보다 "허가 없이 긁지 말라"는 신호와 이용약관 위반의 근거를 남기는
// 용도다 — 검색엔진 등 정상적인 봇만 걸러진다.
//
// 나머지 제외 대상은 검색 결과에 뜰 이유가 없는 것들이다. 로그인·가입은 색인돼도
// 검색으로 들어온 사람에게 보여줄 내용이 없고, /admin은 운영자 전용이며,
// /ladder/[token]은 일회용 공유 토큰 주소다.
//
// public/robots.txt 를 두면 안 된다 — 정적 파일이 이 라우트를 가려서 여기 규칙이
// 통째로 죽는다. 2026-08-25에 실제로 그렇게 만들었고 라이브에서 확인해 걷어냈다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/restaurants.json",
        "/api/",
        "/admin",
        "/login",
        "/signup",
        "/ladder/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
