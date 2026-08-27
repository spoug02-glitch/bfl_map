import { describe, expect, it } from "vitest";
import { TABLES, invertLegacyMap, planMoves } from "@/scripts/migrate-place-ids.mjs";

const legacy = {
  "3090000-101-2024-00209": { kakao_place_id: "1080924210", kakao_url: "http://x/1" },
  "3100000-101-2021-00172": { kakao_place_id: "17266418" },
};

describe("invertLegacyMap", () => {
  it("관리번호→카카오id 파일을 카카오id→관리번호로 뒤집는다", () => {
    const m = invertLegacyMap(legacy);
    expect(m.get("1080924210")).toBe("3090000-101-2024-00209");
    expect(m.get("17266418")).toBe("3100000-101-2021-00172");
    expect(m.size).toBe(2);
  });

  it("카카오 id 가 없는 항목은 건너뛴다", () => {
    // 4,805곳만 카카오 id 가 있다. 나머지는 kakao_place_id 자체가 없다.
    expect(invertLegacyMap({ "3090000-101-2024-00001": {} }).size).toBe(0);
    expect(invertLegacyMap({ "3090000-101-2024-00001": { kakao_url: "http://x" } }).size).toBe(0);
  });

  it("한 카카오 id 가 두 관리번호에 걸리면 먼저 온 것을 쓴다", () => {
    const m = invertLegacyMap({
      "3090000-101-2024-00001": { kakao_place_id: "999" },
      "3090000-101-2024-00002": { kakao_place_id: "999" },
    });
    expect(m.get("999")).toBe("3090000-101-2024-00001");
  });
});

describe("planMoves", () => {
  const mapping = invertLegacyMap(legacy);

  it("매핑된 것만 옮기고 나머지는 남긴다", () => {
    const { moves, unmapped } = planMoves(["1080924210", "8314850"], mapping);
    expect(moves).toEqual([{ from: "1080924210", to: "3090000-101-2024-00209" }]);
    expect(unmapped).toEqual(["8314850"]);
  });

  it("이미 관리번호인 값은 옮기지 않는다 — 재실행이 안전해야 한다", () => {
    const { moves, unmapped } = planMoves(["3090000-101-2024-00209"], mapping);
    expect(moves).toEqual([]);
    expect(unmapped).toEqual(["3090000-101-2024-00209"]);
  });

  it("빈 목록에서도 터지지 않는다", () => {
    expect(planMoves([], mapping)).toEqual({ moves: [], unmapped: [] });
  });
});

describe("TABLES", () => {
  it("place_id 를 든 테이블이 하나도 빠지지 않았다", () => {
    // 하나라도 빠지면 그 테이블만 옛 id 로 남아 조용히 고아가 된다.
    expect(new Set(TABLES)).toEqual(
      new Set(["menu_items", "reviews", "lunch_specials", "saved_places", "reports"]),
    );
  });
});
