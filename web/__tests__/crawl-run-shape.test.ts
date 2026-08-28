import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `collector-runs.json` 은 collect.py 가 쓰고 AdminDashboard 가 읽는다. 사이에
 * 타입 검사가 없다 — 라우트는 JSON 을 그대로 캐스팅해 흘려보낼 뿐이라 필드
 * 이름이 어긋나도 tsc 도 빌드도 통과한다.
 *
 * 2026-08-27 인허가 전환에서 정확히 그 일이 났다. collect.py 가 남기는 키가
 * crawled/matched/... 에서 places/zeropayFlagged/... 로 통째로 바뀌었는데 어드민
 * 표는 옛 키를 계속 읽어, 새로 커밋된 실행 네 줄이 전부
 * `undefined/undefined/undefined/undefined/undefined` 로 그려졌다.
 *
 * 그래서 이 테스트는 실제 커밋된 이력 파일을 읽는다. 픽스처를 지어내면 어긋난
 * 쪽이 아니라 지어낸 쪽을 검사하게 된다.
 */
const HISTORY_PATH = path.join(process.cwd(), "collector-runs.json");

type Row = Record<string, unknown>;

const COMMON = ["startedAt", "finishedAt", "districts"] as const;
// AdminDashboard 가 각 시대에서 실제로 읽는 필드. 여기 없는 필드는 표에 안 나온다.
const PERMIT = ["places", "zeropayFlagged", "zeropayUnmatched"] as const;
const LEGACY = ["crawled", "matched", "unresolved", "outOfRadius", "duplicates"] as const;

const rows: Row[] = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));

describe("collector-runs.json", () => {
  it("비어 있지 않다", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows.map((r, i) => [i, r] as const))("%i번 실행이 어드민 표가 읽는 모양이다", (_i, row) => {
    for (const key of COMMON) expect(row[key]).toBeDefined();
    expect(Array.isArray(row.districts)).toBe(true);

    const expected = row.source === "permit" ? PERMIT : LEGACY;
    for (const key of expected) {
      expect(row[key], `${String(row.source ?? "legacy")} 실행에 ${key} 가 없다`).toBeTypeOf("number");
    }
  });

  it("제로페이를 건너뛴 실행은 그 사실을 남긴다", () => {
    // `--skip-zeropay` 산출물은 모든 플래그가 false 다. 이력에 표시가 없으면
    // 나중에 "이 동네엔 제로페이 되는 집이 없구나"로 읽힌다.
    for (const row of rows) {
      if (row.source !== "permit") continue;
      if (row.zeropayChecked === false) expect(row.zeropayFlagged).toBe(0);
    }
  });
});
