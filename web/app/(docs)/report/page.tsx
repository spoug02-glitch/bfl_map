import type { Metadata } from "next";
import ReportForm from "@/components/ReportForm";
import { SERVICE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `제보 · ${SERVICE.name}`,
  description: `${SERVICE.name} 가게 정보 제보`,
};

export default function ReportPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-on-surface">제보</h1>

      {/* 로그인을 요구하지 않는다. "여기 폐업했어요"를 알려주려던 사람은 로그인
          화면에서 그냥 떠난다. 대신 접수된 내용은 아무것도 자동 반영되지 않는다. */}
      <p className="mt-4 text-on-surface">
        가게 정보가 실제와 다르거나 불편한 점이 있으면 알려주세요. 로그인은 필요 없습니다.
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">
        보내주신 내용은 사람이 직접 읽고 확인한 뒤 반영합니다. 바로 화면에 올라가지 않습니다.
      </p>

      <ReportForm />
    </>
  );
}
