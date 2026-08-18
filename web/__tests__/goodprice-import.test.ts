import { describe, expect, it } from "vitest";
import {
  addressCore,
  buildNameIndex,
  matchPlace,
  menuPricePairs,
  normalizeName,
  parseCsv,
  parsePrice,
  districtOf,
} from "../scripts/import-goodprice.mjs";

type Place = { name: string; address: string; kakao_place_id: string; search_keys?: string[] };
const place = (o: Partial<Place>): Place => ({
  name: "가게", address: "서울특별시 도봉구 노해로69길 15-9", kakao_place_id: "1", ...o,
});

describe("parseCsv", () => {
  it("헤더를 키로 쓴다", () => {
    expect(parseCsv("시도,업소명\n서울,힘찬장어\n")).toEqual([{ 시도: "서울", 업소명: "힘찬장어" }]);
  });
  it("따옴표 안의 쉼표를 셀 구분자로 보지 않는다", () => {
    expect(parseCsv('업소명,메뉴1\n가게,"짜장면,짬뽕"\n')[0]["메뉴1"]).toBe("짜장면,짬뽕");
  });
  it("빈 줄은 버린다", () => {
    expect(parseCsv("업소명\n가게\n\n")).toHaveLength(1);
  });
});

describe("parsePrice", () => {
  it("쉼표와 원을 걷어낸다", () => {
    expect(parsePrice("7,000원")).toBe(7000);
    expect(parsePrice("7000")).toBe(7000);
  });
  it("숫자가 없으면 null", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("시가")).toBeNull();
  });
  // 가격 상한 필터에 쓰이는 값이라, 범위의 높은 쪽을 쓰면 실제보다 비싸게 판단해 가게를 뺀다.
  it("범위는 낮은 쪽을 쓴다", () => {
    expect(parsePrice("5,000~7,000")).toBe(5000);
  });
  it("0이나 음수는 가격이 아니다", () => {
    expect(parsePrice("0")).toBeNull();
  });
});

describe("menuPricePairs", () => {
  it("메뉴N과 가격N을 짝지어 준다", () => {
    expect(menuPricePairs({ 메뉴1: "백반", 가격1: "7000", 메뉴2: "", 가격2: "" }))
      .toEqual([{ menuName: "백반", price: 7000 }]);
  });
  it("가격이 비어도 메뉴는 살린다", () => {
    expect(menuPricePairs({ 메뉴1: "오늘의메뉴", 가격1: "" }))
      .toEqual([{ menuName: "오늘의메뉴", price: null }]);
  });
});

// 실제 CSV 와 restaurants.json 에서 서로 다르게 쓰인 주소들이다. 도로명이
// "동일로217길"처럼 숫자를 품는데 CSV 는 "동일로 217길"로 띄어 쓴다.
describe("addressCore", () => {
  it("띄어쓰기가 달라도 같은 값을 낸다", () => {
    expect(addressCore("서울특별시 노원구 동일로 217길58")).toBe(addressCore("서울특별시 노원구 동일로217길 58"));
    expect(addressCore("서울특별시 노원구 석계로 13길 25-1 1층")).toBe(addressCore("서울특별시 노원구 석계로13길 25-1"));
    expect(addressCore("서울특별시 노원구 상계로 23다길 13-8")).toBe(
      addressCore("서울특별시 노원구 상계로23다길 13-8 (상계동, 노원 아이파크)"),
    );
  });
  it("숫자가 없는 도로명도 읽는다", () => {
    expect(addressCore("서울특별시 강북구 수유로 24, 1층(수유동)")).toBe("수유로24");
  });
  it("괄호 안 법정동과 쉼표 뒤 층수는 무시한다", () => {
    expect(addressCore("서울특별시 도봉구 노해로69길 15-9(창동)")).toBe("노해로69길15-9");
    expect(addressCore("서울특별시 노원구 한글비석로 91, 후문상가 205동 106호")).toBe("한글비석로91");
  });
  it("정말 다른 주소는 다르게 읽는다", () => {
    expect(addressCore("서울특별시 도봉구 덕릉로60길 57(창동)")).not.toBe(
      addressCore("서울특별시 도봉구 덕릉로59길 93 (창동)"),
    );
  });
  it("도로명이 없으면 null", () => {
    expect(addressCore("서울특별시 도봉구 창1동 123")).toBeNull();
  });
});

describe("matchPlace", () => {
  it("이름이 하나만 걸리고 주소가 맞으면 붙인다", () => {
    const p = place({ name: "힘찬장어", address: "서울특별시 도봉구 노해로69길 15-9", kakao_place_id: "99" });
    const got = matchPlace({ 업소명: "힘찬장어", 주소: "서울특별시 도봉구 노해로69길 15-9(창동)" }, buildNameIndex([p]));
    expect(got?.kakao_place_id).toBe("99");
  });

  it("이름이 같아도 주소가 다르면 거절한다", () => {
    const p = place({ name: "화원", address: "서울특별시 도봉구 덕릉로59길 93 (창동)" });
    expect(matchPlace({ 업소명: "화원", 주소: "서울특별시 도봉구 덕릉로60길 57(창동)" }, buildNameIndex([p]))).toBeNull();
  });

  // 같은 상호의 다른 지점을 잘못 붙이는 게 이 작업에서 제일 조용한 실패다.
  it("같은 이름이 여럿이면 주소가 맞는 하나를 고른다", () => {
    const a = place({ name: "홍두깨손칼국수", address: "서울특별시 도봉구 도당로13가길 13", kakao_place_id: "A" });
    const b = place({ name: "홍두깨손칼국수", address: "서울특별시 도봉구 도봉산4가길 14", kakao_place_id: "B" });
    const got = matchPlace({ 업소명: "홍두깨손칼국수", 주소: "서울특별시 도봉구 도봉산4가길 14" }, buildNameIndex([a, b]));
    expect(got?.kakao_place_id).toBe("B");
  });

  it("같은 이름이 여럿인데 주소로도 못 가르면 포기한다", () => {
    const a = place({ name: "남원추어탕", address: "서울특별시 도봉구 해등로 10", kakao_place_id: "A" });
    const b = place({ name: "남원추어탕", address: "서울특별시 도봉구 해등로 20", kakao_place_id: "B" });
    expect(matchPlace({ 업소명: "남원추어탕", 주소: "서울특별시 도봉구 해등로 83" }, buildNameIndex([a, b]))).toBeNull();
  });

  it("우리 목록에 없는 가게는 null", () => {
    expect(matchPlace({ 업소명: "없는집", 주소: "서울특별시 도봉구 노해로 1" }, buildNameIndex([place({})]))).toBeNull();
  });

  it("search_keys 로도 찾는다", () => {
    const p = place({ name: "CU 창동점", search_keys: ["씨유창동점", "cu창동점"], kakao_place_id: "7" });
    const got = matchPlace({ 업소명: "씨유 창동점", 주소: p.address }, buildNameIndex([p]));
    expect(got?.kakao_place_id).toBe("7");
  });
});

describe("normalizeName", () => {
  it("공백과 법인 접두어를 걷어낸다", () => {
    expect(normalizeName("(주) 거궁 창동점")).toBe(normalizeName("거궁창동점"));
  });
  // 도봉구에만 홍두깨손칼국수가 셋이다. 지점명을 지우면 서로 섞인다.
  it("지점명은 남긴다", () => {
    expect(normalizeName("홍두깨손칼국수 방학점")).not.toBe(normalizeName("홍두깨손칼국수"));
  });
});

// 실제 CSV 에서 성북구 "소풍가는날"의 100,000원 제육볶음이 노원구 동명 가게에
// 붙었다. 도로명이 안 읽히는 주소가 흔해서 이름만으로 붙이면 이런 일이 난다.
describe("matchPlace — 자치구 가드", () => {
  it("구가 다르면 이름이 같아도 거절한다", () => {
    const p = place({ name: "소풍가는날", address: "서울특별시 노원구 공릉로34길 62 태강 아파트 상가동 제비 102호" });
    const row = { 업소명: "소풍가는날", 주소: "서울특별시 성북구 보국문로11길 8 (정릉동) 1층" };
    expect(matchPlace(row, buildNameIndex([p]))).toBeNull();
  });

  it("구가 같고 주소가 안 읽히면 이름을 믿는다", () => {
    const p = place({ name: "마들김밥", address: "서울시 노원구 한글비석로 474", kakao_place_id: "5" });
    const row = { 업소명: "마들김밥", 주소: "서울특별시 노원구 한글비석로 474 보람상가" };
    expect(matchPlace(row, buildNameIndex([p]))?.kakao_place_id).toBe("5");
  });

  it("지번 주소라 도로명이 없어도 구가 같으면 붙인다", () => {
    const p = place({ name: "영차", address: "서울특별시 노원구 상계로39길 11 (상계동)", kakao_place_id: "6" });
    const row = { 업소명: "영차", 주소: "서울특별시 노원구 상계동 111-431" };
    expect(matchPlace(row, buildNameIndex([p]))?.kakao_place_id).toBe("6");
  });
});

// PlacePanel 이 공공데이터 메뉴와 카카오 메뉴를 겹치지 않게 그리는 규칙.
// 컴포넌트에 인라인으로 있어 직접 부를 수 없으므로 같은 정규화를 여기서 고정한다.
// 실측(2026-08-17) 공공데이터 104건 중 41건이 카카오에도 있었다.
describe("메뉴 중복 제거 규칙", () => {
  const norm = (s: string) => s.replace(/[\s()]/g, "");
  const dedupe = (dbNames: string[], crawled: string[]) => {
    const seen = new Set(dbNames.map(norm));
    return crawled.filter(n => !seen.has(norm(n)));
  };

  it("같은 메뉴는 카카오 쪽에서 뺀다", () => {
    expect(dedupe(["칼국수"], ["칼국수", "수제비"])).toEqual(["수제비"]);
  });
  it("공백과 괄호 차이는 같은 것으로 본다", () => {
    expect(dedupe(["삼겹살(200g)"], ["삼겹살 (200g)"])).toEqual([]);
  });
  it("다른 메뉴는 남긴다", () => {
    expect(dedupe(["칼국수"], ["보쌈"])).toEqual(["보쌈"]);
  });
  it("공공데이터가 없으면 카카오 메뉴가 그대로 남는다", () => {
    expect(dedupe([], ["칼국수", "보쌈"])).toEqual(["칼국수", "보쌈"]);
  });
});
