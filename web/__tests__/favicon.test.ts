import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// app/icon.png은 해시 붙은 주소(/icon.png?icon.16n8-...)로 나간다. 관습 경로
// /favicon.ico를 그대로 때리는 크롤러·리더는 2026-08-26 라이브에서 404를 받았다.
const ICO = join(process.cwd(), "app", "favicon.ico");

describe("app/favicon.ico", () => {
  it("파일이 있다", () => {
    expect(existsSync(ICO)).toBe(true);
  });

  it("ICO 컨테이너 헤더다", () => {
    const buf = readFileSync(ICO);
    expect(buf.readUInt16LE(0)).toBe(0); // reserved
    expect(buf.readUInt16LE(2)).toBe(1); // 1 = icon
    expect(buf.readUInt16LE(4)).toBeGreaterThanOrEqual(1); // 이미지 개수
  });

  it("32x32 PNG를 품고 있다", () => {
    const buf = readFileSync(ICO);
    expect(buf.readUInt8(6)).toBe(32); // width
    expect(buf.readUInt8(7)).toBe(32); // height

    const size = buf.readUInt32LE(14);
    const offset = buf.readUInt32LE(18);
    expect(offset + size).toBe(buf.length);
    // Vista 이후의 ICO는 PNG를 그대로 품을 수 있다 — 인코더 의존성이 필요 없는 이유.
    expect([...buf.subarray(offset, offset + 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
