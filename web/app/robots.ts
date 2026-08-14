import type { MetadataRoute } from "next";

// restaurants.json은 5,834곳 전체(이름·주소·전화번호·좌표·메뉴)를 한 번의 요청으로
// 통째로 내려주는 정적 파일이다. 악성 스크레이퍼는 robots.txt를 지키지 않으므로
// 이건 막는다기보다 "허가 없이 긁지 말라"는 신호와 이용약관 위반의 근거를 남기는
// 용도다 — 검색엔진 등 정상적인 봇만 걸러진다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/restaurants.json"],
    },
  };
}
