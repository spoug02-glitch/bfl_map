import { describe, expect, it } from "vitest";
import { placeIdFromUrl } from "@/lib/place-url";
import { sharePath } from "@/lib/share-copy";

describe("placeIdFromUrl", () => {
  it("reads the id out of the /place/[id] route", () => {
    expect(placeIdFromUrl("/place/3090000-101-2024-00209", "")).toBe("3090000-101-2024-00209");
  });

  it("round-trips whatever sharePath produced", () => {
    // 목록 앵커의 href를 만드는 쪽과 뒤로가기로 그 href를 다시 읽는 쪽이
    // 어긋나면 popstate가 조용히 아무 가게도 못 찾는다.
    expect(placeIdFromUrl(sharePath("3090000-101-2024-00209"), "")).toBe("3090000-101-2024-00209");
  });

  it("decodes an id that had to be escaped in the path", () => {
    expect(placeIdFromUrl("/place/a%2Fb", "")).toBe("a/b");
  });

  it("still honours the older /?place=... links", () => {
    // 이미 밖에 뿌려진 링크다 — 이 경로가 끊기면 남의 채팅방에 있는 링크가 죽는다.
    expect(placeIdFromUrl("/", "?place=3090000-101-2024-00209")).toBe("3090000-101-2024-00209");
  });

  it("prefers the path over a query parameter when both are present", () => {
    expect(placeIdFromUrl("/place/111", "?place=222")).toBe("111");
  });

  it("returns null for the map's own no-selection URL", () => {
    expect(placeIdFromUrl("/", "")).toBe(null);
  });

  it("returns null for an empty path segment", () => {
    expect(placeIdFromUrl("/place/", "")).toBe(null);
  });

  it("returns null for an unrelated route", () => {
    // /ladder/[token]도 place라는 글자를 안 갖지만, 접두사만 보고 자르면
    // /placeholder 같은 경로가 걸린다.
    expect(placeIdFromUrl("/ladder/abc", "")).toBe(null);
    expect(placeIdFromUrl("/placeholder", "")).toBe(null);
  });

  it("returns null for an empty place query parameter", () => {
    expect(placeIdFromUrl("/", "?place=")).toBe(null);
  });

  it("survives a malformed percent escape instead of throwing", () => {
    // decodeURIComponent("%E0%A4%A") 는 URIError를 던진다. 주소창에 아무나
    // 넣을 수 있는 값이라 이걸로 popstate 핸들러가 죽으면 안 된다.
    expect(placeIdFromUrl("/place/%E0%A4%A", "")).toBe(null);
  });
});
