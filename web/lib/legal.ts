import { CREDIT } from "@/lib/constants";

/** 푸터와 안내 페이지가 공유하는 링크. 한 군데서만 고치면 되도록 모아둔다. */
export const DOC_LINKS = [
  { href: "/about", label: "서비스 소개" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/contact", label: "문의" },
] as const;

/**
 * 계정 제한 안내 문구.
 *
 * "잘못되었다고 생각하면 문의하세요" 같은 말은 쓰지 않는다 — 읽는 사람을
 * 항의할 사람으로 세워두는 문장이라, 대부분은 그럴 생각이 없었는데도 그렇게
 * 만든다. 지금 상태가 무엇이고 무엇은 계속 되는지만 담백하게 알린다.
 *
 * 문의 안내는 별도 문장으로 떼어둔다. 필요한 사람만 읽으면 되는 보조 정보다.
 */
export function suspensionNotice(until: string | null): string {
  const 제한 = until
    ? `현재 계정은 ${until}까지 글쓰기 이용이 제한되어 있습니다.`
    : "현재 계정은 글쓰기 이용이 제한되어 있습니다.";
  return `${제한} 지도 열람과 기존 리뷰 삭제는 계속 이용할 수 있습니다.`;
}

/** 제한 안내 아래에 조용히 붙이는 한 줄. */
export const CONTACT_LINE = `확인이 필요한 내용은 ${CREDIT.email}로 보내주세요.`;
