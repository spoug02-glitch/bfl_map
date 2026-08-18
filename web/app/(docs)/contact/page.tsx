import type { Metadata } from "next";
import Link from "next/link";
import DocSection from "@/components/DocSection";
import { CREDIT, SERVICE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `문의 · ${SERVICE.name}`,
  description: `${SERVICE.name} 문의 안내`,
};

export default function ContactPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-on-surface">문의</h1>

      {/* 예전에는 여기서 메일 주소만 안내했다. 접수 시스템을 두면 답이 늦을 때
          방치된 창구가 된다는 이유였는데, 어드민에 검토 큐가 생겨 그 이유가 사라졌다.
          이제 창구는 두 갈래로 나뉜다 — 나머지는 여전히 메일로 받는다. */}
      <div className="mt-6 space-y-2">
        <Link
          className="flex min-h-11 flex-col justify-center rounded-lg bg-surface-container px-4 py-3 transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
          href="/report"
        >
          <span className="font-bold text-on-surface">제보하기</span>
          <span className="text-sm text-on-surface-variant">
            폐업·이전·가격이 다를 때, 노출을 원하지 않을 때, 부적절한 글을 보셨을 때,
            기능 제안이나 불편한 점
          </span>
        </Link>
        <Link
          className="flex min-h-11 flex-col justify-center rounded-lg bg-surface-container px-4 py-3 transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
          href="/owner"
        >
          <span className="font-bold text-on-surface">내 가게 메뉴 등록하기</span>
          <span className="text-sm text-on-surface-variant">
            가게를 운영하시는 분이 메뉴와 가격을 직접 알려주실 때
          </span>
        </Link>
      </div>

      <DocSection title="두 갈래에 안 맞는 일이라면">
        {/* 메일 주소를 남겨둔다. 폼에 안 맞는 일은 늘 있고, 그때 창구가 아예 없는 게
            답이 늦는 것보다 나쁘다. 계정 문의가 대표적이다 — 폼으로 받으면 본인
            확인이 안 된다. */}
        <p>
          계정 이용에 관한 확인처럼 위 두 가지에 해당하지 않는 내용은{" "}
          <a className="font-bold text-primary underline" href={`mailto:${CREDIT.email}`}>
            {CREDIT.email}
          </a>
          로 보내주세요.
        </p>
        <p className="text-sm text-on-surface-variant">
          개인이 운영하는 서비스라 답변까지 며칠 걸릴 수 있습니다. 급한 일이라면 그 사정도 함께
          적어주세요.
        </p>
      </DocSection>
    </>
  );
}
