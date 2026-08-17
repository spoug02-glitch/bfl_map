import type { Metadata } from "next";
import Link from "next/link";
import DocSection from "@/components/DocSection";
import { CREDIT, SERVICE } from "@/lib/constants";
import { WITHDRAWN_NICKNAME } from "@/lib/nickname";
import { REJOIN_BLOCK_DAYS } from "@/lib/rejoin";

export const metadata: Metadata = {
  title: `개인정보처리방침 · ${SERVICE.name}`,
  description: `${SERVICE.name}이 무엇을 받고, 무엇을 저장하지 않으며, 언제 지우는지`,
};

const UPDATED = "2026-08-16";

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-text-primary">개인정보처리방침</h1>
      <p className="mt-1 text-sm text-text-muted">최종 수정일 {UPDATED}</p>

      <p className="mt-6 rounded-lg bg-surface-muted p-4 text-sm">
        개인이 만들어 운영하는 서비스입니다. <strong>지금은 광고가 없고</strong>, 수집한 정보를
        판매하지 않습니다. 다만 어떤 경로로 들어와 무엇을 보는지 파악하기 위해{" "}
        <strong>구글 애널리틱스</strong>를 사용하며, 이때 방문 기록이 구글로 전송됩니다(아래 6항).
      </p>

      <DocSection title="1. 무엇을 받고 무엇을 저장하나요">
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
          <li><strong>구글 애널리틱스 쿠키</strong>(<code>_ga</code>, <code>_ga_*</code>) — 같은 브라우저의 재방문을 알아보기 위한 무작위 값. 계정과 연결되지 않습니다</li>
        </ul>
      </DocSection>

      <DocSection title="2. 왜 저장하나요">
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>회원번호</strong> — 로그인한 사람을 알아보고, 내가 쓴 글을 내 것으로 표시하기 위해</li>
          <li><strong>닉네임</strong> — 리뷰에 작성자를 표시하고, 같은 이름이 겹치지 않게 하기 위해</li>
          <li><strong>리뷰·제보</strong> — 다른 이용자에게 보여주고 가게 정보를 채우기 위해</li>
          <li><strong>저장한 가게</strong> — 다음에 접속했을 때 그대로 보여주기 위해</li>
          <li><strong>방문 토큰</strong> — 며칠에 몇 명이 왔는지 세기 위해 (계정과 연결하지 않습니다)</li>
        </ul>
      </DocSection>

      <DocSection title="3. 저장하지 않는 것">
        <p>
          이름, 이메일, 전화번호, 생년월일, 성별, 프로필 사진, <strong>위치정보</strong>는 받지도
          저장하지도 않습니다. 지도의 거리는 모두 창동씨드큐브라는 고정된 지점을 기준으로 미리
          계산된 값이라, 사용자의 현재 위치를 알 필요가 없습니다.
        </p>
        <p className="text-sm text-text-muted">
          지도 화면은 카카오맵을 이용해 그립니다. 지도를 보는 과정에서 카카오가 자체적으로 수집하는
          정보는 카카오의 방침을 따릅니다.
        </p>
      </DocSection>

      <DocSection title="4. 어디에 보관되나요 (국외 이전)">
        <p>데이터는 <strong>미국</strong>에 있는 서버에 저장됩니다.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>데이터베이스</strong> — Neon (AWS 미국 오하이오 리전, us-east-2). 위 1항의 저장 항목</li>
          <li><strong>호스팅</strong> — Vercel (미국). 서비스 실행과 접속 로그</li>
          <li><strong>방문 분석</strong> — Google Analytics (구글, 미국). 접속 경로와 화면 이용 기록</li>
        </ul>
        <p className="text-sm text-text-muted">
          이 서비스를 이용하면 위 국외 이전에 동의하는 것이 됩니다. 동의하지 않으시면 로그인 없이도
          지도와 가게 정보는 그대로 보실 수 있습니다.
        </p>
      </DocSection>

      <DocSection title="5. 얼마나 보관하나요">
        <p>
          <strong>탈퇴하면 계정 정보를 즉시 지웁니다.</strong> 카카오 회원번호와 닉네임, 저장한
          가게 목록이 여기에 해당합니다. 따로 백업본을 남기지 않습니다.
        </p>
        <p>
          작성하신 <strong>리뷰와 점심특선 제보는 익명으로 남습니다.</strong> 작성자 표시가{" "}
          <strong>{WITHDRAWN_NICKNAME}</strong>로 바뀌고, 계정과의 연결이 끊어집니다. 다른 이용자가
          보고 있던 가게 평가가 탈퇴 때문에 통째로 사라지지 않도록 하기 위해서입니다.
        </p>
        <p>
          탈퇴한 뒤에는 <strong>{REJOIN_BLOCK_DAYS}일간 재가입할 수 없습니다.</strong> 이를 위해
          카카오 회원번호를 <strong>되돌릴 수 없는 값으로 바꾼 지문</strong> 하나만 그 기간 동안
          보관하고, {REJOIN_BLOCK_DAYS}일이 지나면 지웁니다. 이 값으로는 누구인지 알 수 없고,
          로그인하는 계정과 대조하는 용도로만 씁니다.
        </p>
        <p className="text-sm text-text-muted">
          방문 집계용 토큰은 계정과 무관하게 날짜별로만 쌓입니다.
        </p>
      </DocSection>

      <DocSection title="6. 방문 분석 도구">
        <p>
          어떤 경로로 들어온 분들이 어떤 가게를 보는지 파악하기 위해 <strong>구글 애널리틱스
          (Google Analytics 4)</strong>를 사용합니다. 서비스 개선을 위한 통계 목적입니다.
        </p>
        <p>구글로 전송되는 것은 다음과 같은 <strong>익명 정보</strong>입니다.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>어디에서 들어왔는지(검색·링크 등 유입 경로)</li>
          <li>어떤 화면을 보고 어떤 가게를 열었는지</li>
          <li>기기·브라우저 종류, 대략적인 접속 지역</li>
        </ul>
        <p>
          <strong>닉네임, 카카오 회원번호, 리뷰 내용은 구글로 보내지 않습니다.</strong> 수집된
          기록은 <strong>14개월</strong> 후 삭제됩니다.
        </p>
        <p className="text-sm text-text-muted">
          브라우저의 쿠키 차단 기능이나 광고 차단 확장 프로그램을 쓰시면 이 수집을 거부할 수
          있으며, 거부하셔도 서비스 이용에는 아무런 제한이 없습니다.
        </p>
      </DocSection>

      <DocSection title="7. 탈퇴하려면">
        <p>
          지도 화면 오른쪽 위의 닉네임을 누르면 나오는 창에서 <strong>회원 탈퇴</strong>를 선택하세요.
          계정과 저장한 가게는 지워지고, 남긴 글은 5항대로 익명으로 남습니다.
        </p>
        <p>
          <strong>탈퇴 후에는 남긴 글을 고치거나 지울 수 없습니다.</strong> 누가 쓴 글인지 확인할
          방법이 없어지기 때문입니다. 지우고 싶은 글이 있다면 <strong>탈퇴하기 전에</strong> 각 가게
          화면에서 지워주세요.
        </p>
        <p className="text-sm text-text-muted">
          탈퇴해도 카카오 계정과 이 서비스의 연결은 남아 있을 수 있습니다. 카카오톡 &gt; 더보기 &gt;
          설정 &gt; 개인/보안 &gt; 카카오 계정 &gt; 연결된 서비스 관리에서 직접 해제하실 수 있습니다.
        </p>
      </DocSection>

      <DocSection title="8. 리뷰는 공개됩니다">
        <p>
          작성한 리뷰는 정한 닉네임과 함께 <strong>누구에게나 보입니다.</strong> 로그인하지 않은
          사람에게도 보이므로, 신원이 드러날 만한 내용은 쓰지 않는 편이 좋습니다.
        </p>
      </DocSection>

      <DocSection title="9. 이용자의 권리">
        <p>
          저장된 내 정보를 보거나 고치거나 지울 수 있습니다. 닉네임은 지도 화면에서 바로 바꿀 수
          있고, 리뷰는 각 가게 화면에서 수정·삭제할 수 있습니다. 그 밖의 요청은{" "}
          <Link className="text-accent underline" href="/contact">문의</Link>로 알려주시면 확인해
          처리하겠습니다.
        </p>
      </DocSection>

      <DocSection title="10. 가게 정보의 출처">
        <p>
          가게 목록은 제로페이(비플페이) 가맹점 공개 정보와 카카오맵의 장소 정보를 모아 만들었습니다.
          가게 사진은 쓰지 않습니다. 정보가 실제와 다르거나 노출을 원하지 않는 가게가 있다면{" "}
          <Link className="text-accent underline" href="/contact">문의</Link>로 알려주세요.
        </p>
      </DocSection>

      <DocSection title="11. 문의">
        <p>
          {CREDIT.author} ·{" "}
          <a className="text-accent underline" href={`mailto:${CREDIT.email}`}>{CREDIT.email}</a>
        </p>
      </DocSection>

      <p className="mt-10 border-t border-border-subtle pt-4 text-sm text-text-muted">
        방침이 바뀌면 이 페이지의 최종 수정일을 갱신합니다.
      </p>
    </>
  );
}
