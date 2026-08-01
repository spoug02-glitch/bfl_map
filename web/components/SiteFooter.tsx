import { CONVENIENCE_NOTICE, CREDIT } from "@/lib/constants";

export default function SiteFooter() {
  return (
    <footer
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 bg-surface-page/50 px-3 py-1
        text-[11px] leading-tight text-text-muted backdrop-blur-[2px]"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      <p>
        만든 이 <strong className="text-text-primary">{CREDIT.author}</strong> ·{" "}
        <a className="pointer-events-auto underline" href={`mailto:${CREDIT.email}`}>
          {CREDIT.email}
        </a>
      </p>
      <p className="hidden sm:block">{CONVENIENCE_NOTICE}</p>
    </footer>
  );
}
