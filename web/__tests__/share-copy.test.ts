import { describe, expect, it } from "vitest";
import { shareDescription, sharePath, shareTitle, type ShareSubject } from "@/lib/share-copy";

const sundae: ShareSubject = {
  name: "순대실록 창동씨드큐브점",
  category: "한식 일반 음식점업",
  distance_km: 0.04,
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
  it("leads with the distance", () => {
    expect(shareDescription(sundae)).toBe("씨드큐브에서 0.04km");
  });

  it("stays inside the Kakao feed template's 76 character description limit", () => {
    const long: ShareSubject = { ...sundae, distance_km: 1234.5678 };
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
