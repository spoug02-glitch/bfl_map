import { describe, expect, it } from "vitest";
import { CONTACT_LINE, DOC_LINKS, suspensionNotice } from "@/lib/legal";
import { CREDIT } from "@/lib/constants";

describe("suspensionNotice", () => {
  it("기간 제한이면 날짜를 밝힌다", () => {
    expect(suspensionNotice("2026-09-01")).toBe(
      "현재 계정은 2026-09-01까지 글쓰기 이용이 제한되어 있습니다. 지도 열람과 기존 리뷰 삭제는 계속 이용할 수 있습니다.",
    );
  });

  it("기간이 없으면 날짜 없이 같은 구조로 말한다", () => {
    expect(suspensionNotice(null)).toBe(
      "현재 계정은 글쓰기 이용이 제한되어 있습니다. 지도 열람과 기존 리뷰 삭제는 계속 이용할 수 있습니다.",
    );
  });

  // 읽는 사람을 항의할 사람으로 세워두지 않는다 — 대부분은 그럴 생각이 없었다.
  it("이의 제기를 부추기는 말은 넣지 않는다", () => {
    for (const notice of [suspensionNotice(null), suspensionNotice("2026-09-01")]) {
      expect(notice).not.toContain("잘못");
      expect(notice).not.toContain("이의");
      expect(notice).not.toContain("생각하면");
    }
  });

  it("무엇이 계속 되는지 항상 함께 말한다", () => {
    for (const notice of [suspensionNotice(null), suspensionNotice("2026-09-01")]) {
      expect(notice).toContain("지도 열람");
      expect(notice).toContain("기존 리뷰 삭제");
    }
  });

  it("문의 안내는 제한 문구와 분리되어 있다", () => {
    expect(suspensionNotice(null)).not.toContain(CREDIT.email);
    expect(CONTACT_LINE).toContain(CREDIT.email);
  });
});

describe("DOC_LINKS", () => {
  it("네 페이지가 모두 있고 경로가 겹치지 않는다", () => {
    const hrefs = DOC_LINKS.map(l => l.href);
    expect(hrefs).toEqual(["/about", "/terms", "/privacy", "/contact"]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
