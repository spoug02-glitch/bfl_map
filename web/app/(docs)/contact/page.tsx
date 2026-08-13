import type { Metadata } from "next";
import DocSection from "@/components/DocSection";
import { CREDIT, SERVICE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `문의 · ${SERVICE.name}`,
  description: `${SERVICE.name} 문의 안내`,
};

export default function ContactPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-text-primary">문의</h1>

      {/* 별도 고객센터를 두지 않는다. 혼자 운영하는 서비스에서 접수 시스템을
          만들어두면 답이 늦을 때 오히려 방치된 창구가 된다. */}
      <p className="mt-6 rounded-lg bg-surface-muted p-4">
        확인이 필요한 내용은{" "}
        <a className="font-bold text-accent underline" href={`mailto:${CREDIT.email}`}>
          {CREDIT.email}
        </a>
        로 보내주세요.
      </p>

      <DocSection title="이런 내용을 받습니다">
        <ul className="ml-5 list-disc space-y-1">
          <li>가게 정보가 실제와 다를 때 (폐업·이전·메뉴나 가격 변경)</li>
          <li>가게 노출을 원하지 않으실 때</li>
          <li>부적절한 리뷰나 제보를 발견하셨을 때</li>
          <li>계정 이용에 관해 확인이 필요할 때</li>
          <li>기능 제안이나 불편한 점</li>
        </ul>
      </DocSection>

      <DocSection title="보내주실 때">
        <p>
          가게에 관한 내용이면 <strong>가게 이름</strong>을, 리뷰나 제보에 관한 내용이면 어느
          가게의 어떤 글인지 함께 적어주시면 빠르게 확인할 수 있습니다.
        </p>
        <p className="text-sm text-text-muted">
          개인이 운영하는 서비스라 답변까지 며칠 걸릴 수 있습니다. 급한 일이라면 그 사정도 함께
          적어주세요.
        </p>
      </DocSection>
    </>
  );
}
