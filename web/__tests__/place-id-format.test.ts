import { describe, expect, it } from "vitest";
import { PLACE_ID_RE } from "@/lib/constants";
import { lookupPlace, resolveLegacyPlaceId } from "@/lib/place-index";
import legacyPlaceIds from "@/lib/legacy-place-ids.json";
import shareIndex from "@/lib/share-index.json";

const legacyIdsForTest = () => legacyPlaceIds as Record<string, string>;

/**
 * 2026-08-27에 실제로 밟은 함정을 막는다.
 *
 * 가게 신원이 카카오 place_id(숫자)에서 인허가 관리번호(하이픈 포함)로 바뀌었는데
 * PLACE_ID_RE 가 `/^\d{1,20}$/` 로 남아 있었다. 타입 검사도 빌드도 통과하고,
 * 가게 페이지와 API 만 전부 조용히 404 가 된다.
 */
describe("place id 형식", () => {
  const ids = Object.keys(shareIndex as Record<string, unknown>);

  it("색인의 모든 id 가 정규식을 통과한다", () => {
    const rejected = ids.filter(id => !PLACE_ID_RE.test(id));
    expect(rejected.slice(0, 5)).toEqual([]);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("색인의 모든 id 가 실제로 조회된다", () => {
    // 정규식만 맞고 조회가 안 되면 결과는 똑같이 404 다.
    const missing = ids.filter(id => lookupPlace(id) === undefined);
    expect(missing.slice(0, 5)).toEqual([]);
  });

  it("옛 카카오 id 형식은 PLACE_ID_RE 를 통과하지 못한다", () => {
    // API 본문·사다리 토큰은 새 형식만 받는다. 옛 id 는 오직 /place/[id] 에서
    // resolveLegacyPlaceId 로 새 id 를 찾아 리다이렉트할 때만 쓰인다.
    expect(PLACE_ID_RE.test("833406")).toBe(false);
    expect(lookupPlace("833406")).toBeUndefined();
  });

  it("상속 키로는 가게를 못 얻는다", () => {
    // 경로 파라미터는 누구나 아무 값이나 넣는다.
    for (const key of ["__proto__", "constructor", "toString"]) {
      expect(lookupPlace(key)).toBeUndefined();
    }
  });

  it("모양이 비슷하지만 틀린 값은 거절한다", () => {
    for (const bad of [
      "3090000-101-2024-0020",     // 일련번호 4자리
      "309000-101-2024-00209",     // 자치단체 6자리
      "3090000-101-2024-00209-1",  // 꼬리가 더 붙음
      "3090000_101_2024_00209",    // 구분자가 다름
      "3090000-101-2024-0020a",    // 숫자가 아님
      " 3090000-101-2024-00209",   // 앞 공백
    ]) {
      expect(PLACE_ID_RE.test(bad), bad).toBe(false);
    }
  });
});

/**
 * 옛 카카오 id 로 뿌려진 공유 링크는 남의 채팅방에 박혀 있고 검색 색인과 무관하게
 * 계속 열린다. `place-url.ts` 가 *"이 경로가 끊기면 남의 채팅방에 있는 링크가
 * 죽는다"* 고 경고하던 그 문제를, 신원을 관리번호로 바꾸면서 실제로 깨뜨렸다.
 */
describe("옛 카카오 id 호환", () => {
  it("아는 옛 id 는 새 관리번호로 해석된다", () => {
    // 실제 표에 있는 값이다 (강북구 어느 가게). 지어낸 id 를 쓰면 표가 비어도
    // 테스트가 통과해버린다.
    const resolved = resolveLegacyPlaceId("833406");
    expect(resolved).toBeDefined();
    expect(PLACE_ID_RE.test(resolved!)).toBe(true);
    // 해석 결과가 실제로 조회되지 않으면 리다이렉트해도 soft 404 다.
    expect(lookupPlace(resolved!)).toBeDefined();
  });

  it("모르는 숫자 id 는 undefined 다 — 아무 데나 보내지 않는다", () => {
    expect(resolveLegacyPlaceId("99999999999")).toBeUndefined();
  });

  it("관리번호를 옛 id 로 오인하지 않는다", () => {
    expect(resolveLegacyPlaceId("3090000-101-2024-00209")).toBeUndefined();
  });

  it("상속 키로는 아무것도 안 나온다", () => {
    for (const key of ["__proto__", "constructor", "toString"]) {
      expect(resolveLegacyPlaceId(key)).toBeUndefined();
    }
  });

  it("해석된 모든 옛 id 가 색인에 있다", () => {
    // 표가 restaurants.json 에서 생성되므로 어긋날 수 없지만, 어긋나면
    // 리다이렉트가 통째로 soft 404 로 떨어지므로 전수로 확인한다.
    const legacy = legacyIdsForTest();
    const broken = Object.entries(legacy)
      .filter(([, permitNo]) => lookupPlace(permitNo) === undefined)
      .slice(0, 5);
    expect(broken).toEqual([]);
    expect(Object.keys(legacy).length).toBeGreaterThan(1000);
  });
});
