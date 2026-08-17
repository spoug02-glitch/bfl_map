import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

/**
 * 안내·정책 페이지의 공통 껍데기.
 *
 * 지도는 h-dvh 앱 셸이지만 이 페이지들은 그냥 읽는 문서다. 읽기 편한 폭(max-w-2xl)과
 * 줄간격만 잡아주고, 돌아가는 길과 푸터를 공통으로 둔다. 라우트 그룹이라 주소에는
 * (docs)가 붙지 않는다 — /privacy 같은 기존 링크가 그대로 살아 있다.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-surface px-5 py-10 text-base leading-relaxed">
      <Link className="text-sm text-primary underline" href="/">← 지도로 돌아가기</Link>
      {children}
      <SiteFooter />
    </main>
  );
}
