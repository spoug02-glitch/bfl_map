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
    // 앱의 나머지와 같은 포맷으로 말한다 — 공유 카드에서 "0.04km"는 읽는 사람이
    // 한 번 환산해야 하는 숫자다.
    expect(shareDescription(sundae)).toBe("씨드큐브에서 40m");
  });

  it("uses one decimal past a kilometre, like every other screen", () => {
    expect(shareDescription({ ...sundae, distance_km: 2.35 })).toBe("씨드큐브에서 2.4km");
  });

  it("stays inside the Kakao feed template's 76 character description limit", () => {
    const long: ShareSubject = { ...sundae, distance_km: 1234.5678 };
    expect(shareDescription(long).length).toBeLessThanOrEqual(76);
  });
});

describe("sharePath", () => {
  it("points at the route that carries per-place OG tags", () => {
    // /?place=... 로 돌아가면 슬랙 카드가 모든 가게에 대해 똑같아진다
    expect(sharePath("3090000-101-2024-00209")).toBe("/place/3090000-101-2024-00209");
  });

  it("encodes an id that would otherwise break the path", () => {
    expect(sharePath("a/b?c")).toBe("/place/a%2Fb%3Fc");
  });
});
