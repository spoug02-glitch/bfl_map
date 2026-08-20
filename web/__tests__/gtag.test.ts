import { beforeEach, describe, expect, it, vi } from "vitest";

/** window.gtag 자리에 스파이를 꽂고 모듈을 새로 불러온다. */
async function loadGtag(gaId: string | undefined) {
  vi.resetModules();
  if (gaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
  else process.env.NEXT_PUBLIC_GA_ID = gaId;
  return import("@/lib/gtag");
}

beforeEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_GA_ID;
});

describe("track", () => {
  it("GA_ID가 없으면 gtag를 부르지 않는다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag(undefined);
    track({ name: "place_map_open", place_id: "123", place_category: "한식" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("window.gtag가 없어도 던지지 않는다 (광고 차단)", async () => {
    vi.stubGlobal("window", {});
    const { track } = await loadGtag("G-TEST123456");
    expect(() =>
      track({ name: "place_map_open", place_id: "123", place_category: "한식" }),
    ).not.toThrow();
  });

  it("window가 아예 없어도 던지지 않는다 (SSR)", async () => {
    vi.stubGlobal("window", undefined);
    const { track } = await loadGtag("G-TEST123456");
    expect(() =>
      track({ name: "place_map_open", place_id: "123", place_category: "한식" }),
    ).not.toThrow();
  });

  it("이름을 첫 인자로, 나머지 파라미터를 객체로 넘긴다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({
      name: "place_view",
      place_id: "42",
      place_category: "중식",
      entry_context: "marker",
      place_kind: "meal",
      has_menu: true,
      menu_count: 3,
    });
    expect(spy).toHaveBeenCalledWith("event", "place_view", {
      place_id: "42",
      place_category: "중식",
      entry_context: "marker",
      place_kind: "meal",
      has_menu: true,
      menu_count: 3,
    });
  });

  // has_menu 는 GA4에서 세그먼트를 가르는 축이다. 값이 통째로 빠지면 두 집단을
  // 나눌 수 없어 분석 자체가 불가능해지므로, false 도 반드시 실려 나가야 한다.
  it("has_menu 가 false 여도 파라미터에서 빠지지 않는다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({
      name: "place_view",
      place_id: "7",
      place_category: "체인화 편의점",
      entry_context: "list",
      place_kind: "convenience",
      has_menu: false,
      menu_count: 0,
    });
    const params = spy.mock.calls[0][2];
    expect(params).toHaveProperty("has_menu", false);
    expect(params).toHaveProperty("menu_count", 0);
    expect(params).toHaveProperty("place_kind", "convenience");
  });

  it("roulette_again 은 후보 수를 함께 보낸다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({ name: "roulette_again", pool_size: 4 });
    expect(spy).toHaveBeenCalledWith("event", "roulette_again", { pool_size: 4 });
  });

  it("name은 페이로드에 포함되지 않는다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({ name: "login_start", trigger: "header" });
    expect(spy).toHaveBeenCalledWith("event", "login_start", { trigger: "header" });
  });

  it("파라미터가 없는 이벤트는 빈 객체를 넘긴다", async () => {
    const spy = vi.fn();
    vi.stubGlobal("window", { gtag: spy });
    const { track } = await loadGtag("G-TEST123456");
    track({ name: "roulette_share", pool_size: 4 });
    expect(spy).toHaveBeenCalledWith("event", "roulette_share", { pool_size: 4 });
  });
});
