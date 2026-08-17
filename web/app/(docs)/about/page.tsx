import type { Metadata } from "next";
import Link from "next/link";
import DocSection from "@/components/DocSection";
import { OFFICE_LABEL, SERVICE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `서비스 소개 · ${SERVICE.name}`,
  description: SERVICE.tagline,
};

export default function AboutPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-on-surface">서비스 소개</h1>
      <p className="mt-1 text-sm text-on-surface-variant">{SERVICE.tagline}</p>

      <p className="mt-6 rounded-lg bg-surface-container p-4 text-sm">
        점심시간마다 &ldquo;오늘 뭐 먹지&rdquo; 하고 멈추는 시간을 줄여보려고 만들었습니다.
        회사 주변 밥집을 지도에 모아두고, 못 정하겠을 때는 룰렛이 대신 골라줍니다.
      </p>

      <DocSection title="무엇을 볼 수 있나요">
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>{OFFICE_LABEL} 주변 밥집 지도</strong> — 거리순 목록과 함께 봅니다</li>
          <li><strong>예산으로 거르기</strong> — 1만원 이하처럼 상한을 정해두면 그 안에서만 보입니다</li>
          <li><strong>룰렛</strong> — 후보를 담고 돌리면 한 곳을 뽑아줍니다. 결과는 링크로 공유할 수 있습니다</li>
          <li><strong>리뷰와 점심특선 제보</strong> — 짧은 후기와, 지도에 안 나오는 점심 메뉴·가격을 남길 수 있습니다</li>
        </ul>
      </DocSection>

      {/* 비플페이는 사실 설명으로만 쓴다. 제휴·공식 서비스로 읽히면 안 된다. */}
      <DocSection title="비플페이 관련 안내">
        <p>
          지도에 실린 가게는 <strong>제로페이(비플페이) 가맹점 공개 정보</strong>를 바탕으로
          모았습니다. 그래서 결제 수단을 신경 쓰는 분이 가게를 찾는 데 도움이 됩니다.
        </p>
        <p className="rounded-lg bg-surface-container p-4 text-sm">
          다만 이 서비스는 <strong>비플페이·제로페이와 아무 관계가 없는 개인 서비스</strong>입니다.
          제휴하거나 위탁받아 만든 것이 아니고, 운영 주체도 다릅니다. 가맹점 여부와 실제 결제
          가능 여부는 <strong>가게에서 직접 확인해 주세요</strong> — 공개 정보와 실제가 다를 수
          있고, 가맹 상태는 저희가 모르는 사이에 바뀝니다.
        </p>
      </DocSection>

      <DocSection title="정보가 정확한가요">
        <p>
          가게 정보는 공개 정보와 카카오맵 장소 정보를 모아 주기적으로 갱신하지만, 폐업·이전·메뉴
          변경이 곧바로 반영되지는 않습니다. <strong>점심특선 제보는 이용자가 남긴 정보라 확인된
          내용이 아닙니다.</strong> 중요한 결정은 가게에 확인하고 하시는 편이 안전합니다.
        </p>
        <p>
          정보가 실제와 다르거나 노출을 원하지 않는 가게가 있다면{" "}
          <Link className="text-primary underline" href="/contact">문의</Link>로 알려주세요.
        </p>
      </DocSection>

      <DocSection title="만든 사람">
        <p>
          개인이 만들어 운영합니다. 아직 초기 단계라 기능과 문서가 자주 바뀝니다. 쓰다가 불편한
          점이 보이면 알려주시면 반영하겠습니다.
        </p>
      </DocSection>
    </>
  );
}
