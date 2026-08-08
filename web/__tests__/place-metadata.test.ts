import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/place/[id]/page";
import shareIndex from "@/lib/share-index.json";

const someId = Object.keys(shareIndex)[0];

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("generateMetadata for /place/[id]", () => {
  it("describes a real place with its own title", async () => {
    const meta = await generateMetadata(params(someId));
    const place = (shareIndex as Record<string, { name: string }>)[someId];
    expect(meta.title).toContain(place.name);
    expect(meta.openGraph?.title).toBe(meta.title);
  });

  it("falls back to the app card for an id that is not in the index", async () => {
    const meta = await generateMetadata(params("99999999999"));
    expect(meta.title).toBe("직장인 맛창고");
    expect(meta.openGraph).toBeUndefined();
  });

  // 경로 파라미터는 누구나 아무 값이나 넣는다. 평범한 객체 조회는 상속 키에 걸려
  // "없는 가게"인데도 객체/함수를 돌려주고, 그러면 fallback을 지나쳐 터진다.
  it.each(["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"])(
    "falls back instead of crashing on the inherited key %s",
    async (key) => {
      const meta = await generateMetadata(params(key));
      expect(meta.title).toBe("직장인 맛창고");
      expect(meta.openGraph).toBeUndefined();
    },
  );

  it.each(["abc", "12a", "../secret", "1080924210 ", ""])(
    "falls back on the malformed id %j",
    async (id) => {
      const meta = await generateMetadata(params(id));
      expect(meta.title).toBe("직장인 맛창고");
    },
  );
});
