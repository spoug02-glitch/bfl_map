import type { Metadata } from "next";
import DocSection from "@/components/DocSection";
import OwnerMenuForm from "@/components/OwnerMenuForm";
import { SERVICE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `업주 메뉴 등록 · ${SERVICE.name}`,
  description: `${SERVICE.name} 가게 메뉴·가격 등록`,
};

export default function OwnerPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-on-surface">
        내 가게 메뉴 등록
      </h1>

      {/* 계정을 만들게 하지 않는다. 한 번 제출하고 끝나는 흐름이라 로그인·비밀번호가
          붙으면 얻는 것 없이 문턱만 생긴다. */}
      <p className="mt-4 text-on-surface">
        가게 메뉴와 가격을 알려주시면 지도에 올립니다. 회원가입은 필요 없고, 무료입니다.
      </p>

      <OwnerMenuForm />

      <DocSection title="올린 뒤에 이렇게 됩니다">
        <p>
          보내주신 메뉴는 <strong>바로 노출되지 않습니다.</strong> 아무나 남의 가게 가격을
          바꿀 수 있으면 안 되기 때문에, 사람이 하나씩 확인한 뒤에 확정합니다.
        </p>
        <p>
          확인 전까지 메뉴는 <strong>미확인</strong>으로 표시되고, 가격 필터에도 잡히지
          않습니다. 확인이 끝나면 표시가 사라지고 검색·필터에 정상적으로 들어갑니다.
        </p>
        <p className="text-sm text-on-surface-variant">
          개인이 운영하는 서비스라 확인까지 며칠 걸릴 수 있습니다. 확인 중 궁금한 점이
          생기면 적어주신 연락처로 연락드립니다.
        </p>
      </DocSection>
    </>
  );
}
