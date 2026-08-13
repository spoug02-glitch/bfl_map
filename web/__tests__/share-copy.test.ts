import { describe, expect, it } from "vitest";
import { shareDescription, sharePath, shareTitle, type ShareSubject } from "@/lib/share-copy";

const sundae: ShareSubject = {
  name: "순대실록 창동씨드큐브점",
  category: "한식 일반 음식점업",
  distance_km: 0.04,
  menus: [{ name: "항정 순대국", price: "15000" }],
};

describe("shareTitle", () => {
  it("joins the name and category", () => {
    expect(shareTitle(sundae)).toBe("순대실록 창동씨드큐브점 · 한식 일반 음식점업");
  });

  it("stays inside the Kakao feed template's 40 character title limit", () => {
    const long: ShareSubject = { ...sundae, name: "가".repeat(60) };
    expect(shareTitle(long).length).toBeLessThanOrEqual(40);
  });
});

describe("shareDescription", () => {
  it("leads with the distance and adds the top menu with a formatted price", () => {
    expect(shareDescription(sundae)).toBe("씨드큐브에서 0.04km · 항정 순대국 15,000원");
  });

  it("omits the menu clause when the place has no menu", () => {
    expect(shareDescription({ ...sundae, menus: [] })).toBe("씨드큐브에서 0.04km");
  });

  it("omits the menu clause when the menu carries no price", () => {
    // 편의점처럼 가격이 비어 오는 경우 — "메뉴 원"이 붙으면 안 된다
    expect(shareDescription({ ...sundae, menus: [{ name: "도시락", price: "" }] })).toBe(
      "씨드큐브에서 0.04km",
    );
  });

  it("omits the menu clause when Kakao reports the price as undisclosed", () => {
    // 카카오 panel3은 가격 미공개를 "-1"로 준다 (수집분의 25%). 그대로 쓰면
    // 공유 카드에 "-1원"이 나가 틀린 가격을 퍼뜨린다.
    const undisclosed = { ...sundae, menus: [{ name: "더티땅콩라떼", price: "-1" }] };
    expect(shareDescription(undisclosed)).toBe("씨드큐브에서 0.04km");
    expect(shareDescription(undisclosed)).not.toContain("-1");
  });

  it("stays inside the Kakao feed template's 76 character description limit", () => {
    const long: ShareSubject = { ...sundae, menus: [{ name: "가".repeat(80), price: "1000" }] };
    expect(shareDescription(long).length).toBeLessThanOrEqual(76);
  });
});

describe("sharePath", () => {
  it("points at the route that carries per-place OG tags", () => {
    // /?place=... 로 돌아가면 슬랙 카드가 모든 가게에 대해 똑같아진다
    expect(sharePath("1080924210")).toBe("/place/1080924210");
  });

  it("encodes an id that would otherwise break the path", () => {
    expect(sharePath("a/b?c")).toBe("/place/a%2Fb%3Fc");
  });
});
