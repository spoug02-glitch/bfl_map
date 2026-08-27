import { describe, expect, it } from "vitest";
import { PLACE_ID_RE } from "@/lib/constants";
import { lookupPlace } from "@/lib/place-index";
import shareIndex from "@/lib/share-index.json";

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

  it("옛 카카오 id 형식은 이제 거절한다", () => {
    expect(PLACE_ID_RE.test("1080924210")).toBe(false);
    expect(lookupPlace("1080924210")).toBeUndefined();
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
