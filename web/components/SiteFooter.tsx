import Link from "next/link";
import { CONVENIENCE_NOTICE, CREDIT, SERVICE } from "@/lib/constants";
import { DOC_LINKS } from "@/lib/legal";

const YEAR = 2026;

/**
 * 공통 푸터. 두 자리에 서로 다른 모습으로 선다.
 *
 * 지도 화면은 h-dvh 앱 셸이라 문서용 푸터를 그대로 두면 지도가 그만큼 밀린다.
 * 그래서 지도에서는 바닥에 얇게 겹쳐 띄우고(overlay), 안내 페이지에서는 문서
 * 흐름 안에 보통 푸터로 놓는다. 링크 목록과 저작권 문구는 한 벌만 유지한다.
 */
export default function SiteFooter({ overlay = false }: { overlay?: boolean }) {
  const links = (
    // 모바일에서 링크가 붙어 보이지 않게 간격을 넉넉히 주고, 터치 표적도 넓힌다.
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {DOC_LINKS.map(l => (
        <Link
          key={l.href}
          href={l.href}
          className={`underline underline-offset-2 ${overlay ? "pointer-events-auto py-0.5" : "py-1"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  if (overlay) {
    return (
      <footer
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 bg-surface-page/50 px-3 py-1
          text-[11px] leading-tight text-text-muted backdrop-blur-[2px]"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        {links}
        <p className="hidden sm:block">{CONVENIENCE_NOTICE}</p>
      </footer>
    );
  }

  return (
    <footer className="mt-12 border-t border-border-subtle pt-6 text-sm text-text-muted">
      <p className="font-bold text-text-primary">{SERVICE.name}</p>
      <p className="mt-0.5">{SERVICE.tagline}</p>

      <div className="mt-4">{links}</div>

      <p className="mt-4">
        문의{" "}
        <a className="text-accent underline" href={`mailto:${CREDIT.email}`}>
          {CREDIT.email}
        </a>
      </p>
      {/* 대표자 실명과 사업장 주소는 넣지 않는다 — 판매를 하지 않아 표시의무가
          없고, 공개하면 되돌릴 수 없다. 이유는 constants의 CREDIT 주석에. */}
      <p className="mt-1 text-xs">
        {CREDIT.author} · 사업자등록번호 {CREDIT.bizNumber}
      </p>
      <p className="mt-3 text-xs">© {YEAR} {CREDIT.author}</p>
    </footer>
  );
}
