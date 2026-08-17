import type { Metadata } from "next";
import Link from "next/link";
import DocSection from "@/components/DocSection";
import { NICKNAME_MAX_LEN, WITHDRAWN_NICKNAME } from "@/lib/nickname";
import { SERVICE } from "@/lib/constants";

export const metadata: Metadata = {
  title: `이용약관 · ${SERVICE.name}`,
  description: `${SERVICE.name}을 이용할 때의 약속`,
};

const UPDATED = "2026-08-13";

export default function TermsPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-on-surface">이용약관</h1>
      <p className="mt-1 text-sm text-on-surface-variant">최종 수정일 {UPDATED}</p>

      <p className="mt-6 rounded-lg bg-surface-container p-4 text-sm">
        초기 서비스라 최소한의 내용만 담은 초안입니다. 서비스가 바뀌면 이 문서도 함께 고치고,
        수정일을 갱신합니다.
      </p>

      <DocSection title="1. 이 약관은 무엇인가요">
        <p>
          {SERVICE.name}(이하 &ldquo;서비스&rdquo;)을 이용할 때 서로 지켰으면 하는 내용을 적어둔
          문서입니다. 서비스를 이용하면 이 내용에 동의한 것으로 봅니다.
        </p>
      </DocSection>

      <DocSection title="2. 어떤 서비스인가요">
        <p>
          회사 주변 밥집을 지도로 보여주고, 리뷰와 점심특선 정보를 남길 수 있는 서비스입니다.
          이용료는 없습니다.
        </p>
        <p>
          지도에 실린 가게 정보는 공개 정보를 모아 만든 것이라 실제와 다를 수 있습니다. 서비스는
          가게의 영업 상태·메뉴·가격·결제 수단을 보증하지 않습니다.
        </p>
      </DocSection>

      <DocSection title="3. 로그인과 닉네임">
        <p>
          리뷰와 제보를 남기려면 카카오 로그인이 필요합니다. 리뷰에는 카카오 프로필 이름이 아니라
          <strong> 서비스에서 직접 정한 닉네임</strong>이 표시됩니다({NICKNAME_MAX_LEN}자 이내).
        </p>
        <p>
          다른 사람이나 기관을 사칭하는 닉네임, 욕설·혐오 표현이 담긴 닉네임은 쓸 수 없습니다.
          이미 쓰고 있는 닉네임은 다시 쓸 수 없습니다.
        </p>
      </DocSection>

      <DocSection title="4. 리뷰와 제보">
        <p>남긴 글은 닉네임과 함께 누구에게나 공개됩니다. 아래 내용은 남기지 말아주세요.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>욕설, 혐오 표현, 특정인을 향한 공격</li>
          <li>사실과 다른 내용으로 가게의 평판을 해치는 글</li>
          <li>다른 사람의 개인정보나 신원이 드러나는 내용</li>
          <li>광고·홍보, 같은 내용의 반복 게시</li>
          <li>본인이 쓰지 않은 글이나 사진 등 남의 것을 옮겨 온 내용</li>
        </ul>
        <p>
          같은 가게에는 일정 기간마다 한 번씩만 리뷰를 남길 수 있습니다. 짧은 시간에 여러 번
          작성하면 잠시 제한될 수 있습니다.
        </p>
      </DocSection>

      {/* 사용자가 남긴 글이 서비스의 자료가 된다는 점을 밝히되, 실제 동작(탈퇴 시
          전부 삭제)과 어긋나지 않게 적는다. 문서가 코드보다 더 많은 권리를
          주장하면 그건 약관이 아니라 빈말이 된다. */}
      <DocSection title="5. 남긴 글은 어떻게 쓰이나요">
        <p>
          남긴 리뷰와 점심특선 제보는 서비스에 저장되어, 서비스 안에서 다른 이용자에게 보여주고
          가게 정보를 채우는 데 쓰입니다. 글의 권리는 작성자에게 있습니다.
        </p>
        <p>
          <strong>탈퇴하면 계정은 지워지고, 남긴 글은 {WITHDRAWN_NICKNAME}로 남습니다.</strong>{" "}
          다른 이용자가 보고 있던 가게 평가가 통째로 사라지지 않게 하기 위해서입니다. 계정과의
          연결이 끊어지므로 탈퇴 후에는 고치거나 지울 수 없습니다 — 지우고 싶은 글은 탈퇴 전에
          지워주세요. 자세한 내용은{" "}
          <Link className="text-primary underline" href="/privacy">개인정보처리방침</Link>에 있습니다.
        </p>
      </DocSection>

      <DocSection title="6. 이용이 제한될 수 있는 경우">
        <p>
          4항의 내용을 반복해서 남기거나 다른 이용자에게 피해를 주는 경우, 글쓰기 이용이 일정 기간
          또는 계속 제한될 수 있습니다. 제한 중에도 <strong>지도 열람과 기존 리뷰 삭제는 그대로
          이용할 수 있습니다.</strong>
        </p>
        <p>명백히 문제가 되는 글은 알림 없이 지울 수 있습니다.</p>
      </DocSection>

      <DocSection title="7. 서비스 변경과 중단">
        <p>
          개인이 운영하는 서비스라 기능이 바뀌거나, 사정에 따라 운영을 멈출 수 있습니다. 미리
          알릴 수 있으면 알리겠지만, 그러지 못하는 경우도 있습니다.
        </p>
      </DocSection>

      <DocSection title="8. 책임의 범위">
        <p>
          서비스는 무료로 제공되며, 정보가 정확하다고 보증하지 않습니다. 가게 정보나 다른 이용자가
          남긴 글을 믿고 한 선택의 결과까지 서비스가 책임지기는 어렵습니다. 다만 서비스의 잘못으로
          생긴 문제에 대한 책임까지 면하는 것은 아닙니다.
        </p>
      </DocSection>

      <DocSection title="9. 데이터 수집 금지">
        <p>
          허가 없이 서비스의 정보(가게 목록, 리뷰 등)를 자동화된 방법으로 대량 수집·복제하는 것을
          금지합니다. 위반이 확인되면 접근을 제한할 수 있습니다.
        </p>
      </DocSection>

      <DocSection title="10. 문의">
        <p>
          약관에 대해 궁금한 점은{" "}
          <Link className="text-primary underline" href="/contact">문의</Link>로 알려주세요.
        </p>
      </DocSection>
    </>
  );
}
