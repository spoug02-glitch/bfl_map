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
  it("경로가 겹치지 않는다", () => {
    const hrefs = DOC_LINKS.map(l => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  // 접수 경로가 푸터에 없으면 /contact 를 통해서만 닿는데, 그건 문의를 하러
  // 들어온 사람만 발견한다는 뜻이다.
  it("제보와 업주 등록으로 가는 길이 푸터에 있다", () => {
    const hrefs = DOC_LINKS.map(l => l.href);
    expect(hrefs).toContain("/report");
    expect(hrefs).toContain("/owner");
  });

  it("법적 고지 페이지가 빠지지 않는다", () => {
    const hrefs = DOC_LINKS.map(l => l.href);
    for (const h of ["/about", "/terms", "/privacy", "/contact"]) expect(hrefs).toContain(h);
  });
});
