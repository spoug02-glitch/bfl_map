import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "개인정보 처리방침 · 직장인 맛집지도",
  description: "직장인 맛집지도가 무엇을 받고, 무엇을 저장하지 않으며, 언제 지우는지",
};

const UPDATED = "2026-08-05";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      <div className="mt-2 space-y-2 text-text-primary">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-surface px-5 py-10 text-base leading-relaxed">
      <Link className="text-sm text-accent underline" href="/">← 지도로 돌아가기</Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-text-primary">개인정보 처리방침</h1>
      <p className="mt-1 text-sm text-text-muted">최종 수정일 {UPDATED}</p>

      <p className="mt-6 rounded-lg bg-surface-muted p-4 text-sm">
        이 서비스는 개인이 만들어 운영하는 비영리 사이드 프로젝트입니다. 광고를 붙이지 않고,
        수집한 정보를 판매하거나 제3자에게 제공하지 않습니다.
      </p>

      <Section title="1. 무엇을 받고 무엇을 저장하나요">
        <p>
          카카오 로그인을 하면 카카오가 <strong>회원번호</strong>와 <strong>프로필 닉네임</strong>을
          전달합니다. 이 중 <strong>회원번호만 저장</strong>하고, 카카오 프로필 닉네임은 받는 즉시
          버립니다 — 대부분의 사람이 카카오 프로필에 본명을 쓰기 때문입니다.
        </p>
        <p>실제로 저장되는 항목은 다음이 전부입니다.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>카카오 회원번호</strong> — 같은 사람인지 알아보기 위해</li>
          <li><strong>이 서비스에서 직접 정한 닉네임</strong> — 리뷰에 표시되는 이름</li>
          <li><strong>작성한 리뷰</strong> — 별점 두 개와 100자 이내의 글</li>
          <li><strong>점심특선 제보</strong> — 메뉴명, 가격, 맛별점, 비고. 닉네임 없이 내용만 공개됩니다</li>
          <li><strong>저장한 가게 목록</strong></li>
          <li><strong>방문 집계용 임의 토큰</strong> — 브라우저가 만든 무작위 값. 계정과 연결되지 않으며, 브라우저 데이터를 지우면 사라집니다</li>
        </ul>
      </Section>

      <Section title="2. 저장하지 않는 것">
        <p>
          이름, 이메일, 전화번호, 생년월일, 성별, 프로필 사진, 위치정보는 <strong>받지도 저장하지도
          않습니다.</strong> 지도의 거리는 모두 창동씨드큐브라는 고정된 지점을 기준으로 미리 계산된
          값이라, 사용자의 현재 위치를 알 필요가 없습니다.
        </p>
      </Section>

      <Section title="3. 어디에 보관되나요 (국외 이전)">
        <p>
          데이터는 <strong>미국</strong>에 있는 서버에 저장됩니다.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>데이터베이스</strong> — Neon (AWS 미국 오하이오 리전, us-east-2). 위 1항의 저장 항목</li>
          <li><strong>호스팅</strong> — Vercel (미국). 서비스 실행과 접속 로그</li>
        </ul>
        <p className="text-sm text-text-muted">
          이 서비스를 이용하면 위 국외 이전에 동의하는 것이 됩니다. 동의하지 않으시면 로그인 없이도
          지도와 가게 정보는 그대로 보실 수 있습니다.
        </p>
      </Section>

      <Section title="4. 얼마나 보관하나요">
        <p>
          탈퇴할 때까지 보관하고, <strong>탈퇴하면 즉시 지웁니다.</strong> 따로 백업본을 남기지
          않습니다. 방문 집계용 토큰은 계정과 무관하게 날짜별로만 쌓입니다.
        </p>
      </Section>

      <Section title="5. 탈퇴하려면">
        <p>
          지도 화면 오른쪽 위의 닉네임을 누르면 나오는 창에서 <strong>회원 탈퇴</strong>를 선택하세요.
          계정, 작성한 리뷰, 점심특선 제보, 저장한 가게가 모두 지워집니다. <strong>되돌릴 수 없습니다.</strong>
        </p>
        <p className="text-sm text-text-muted">
          탈퇴해도 카카오 계정과 이 서비스의 연결은 남아 있을 수 있습니다. 카카오톡 &gt; 더보기 &gt;
          설정 &gt; 개인/보안 &gt; 카카오 계정 &gt; 연결된 서비스 관리에서 직접 해제하실 수 있습니다.
        </p>
      </Section>

      <Section title="6. 리뷰는 공개됩니다">
        <p>
          작성한 리뷰는 정한 닉네임과 함께 <strong>누구에게나 보입니다.</strong> 로그인하지 않은
          사람에게도 보이므로, 신원이 드러날 만한 내용은 쓰지 않는 편이 좋습니다.
        </p>
      </Section>

      <Section title="7. 가게 정보의 출처">
        <p>
          가게 목록은 제로페이(비플페이) 가맹점 공개 정보와 카카오맵의 장소 정보를 모아 만들었습니다.
          가게 사진은 쓰지 않습니다. 정보가 실제와 다르거나 노출을 원하지 않는 가게가 있다면 아래로
          알려주세요.
        </p>
      </Section>

      <Section title="8. 문의">
        <p>
          {CREDIT.author} ·{" "}
          <a className="text-accent underline" href={`mailto:${CREDIT.email}`}>{CREDIT.email}</a>
        </p>
      </Section>

      <p className="mt-10 border-t border-border-subtle pt-4 text-sm text-text-muted">
        방침이 바뀌면 이 페이지의 최종 수정일을 갱신합니다.
      </p>
    </main>
  );
}
