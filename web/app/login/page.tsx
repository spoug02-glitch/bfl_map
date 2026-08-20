import Link from "next/link";

// 구글 로그인은 가입과 로그인을 가르지 않는다 — 첫 로그인이 곧 가입이다
// (닉네임은 로그인 후 모달에서 받는다, 카카오와 동일). 그래서 이 페이지와
// /signup은 문구만 다를 뿐 버튼은 같은 곳을 가리킨다.
export default function LoginPage() {
  return (
    <div className="mx-auto mt-24 max-w-xs px-6">
      <h1 className="text-lg font-bold text-on-surface">로그인</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        구글 계정으로 로그인하면 리뷰와 저장한 가게를 이어서 쓸 수 있어요.
      </p>
      <a
        className="mt-6 grid h-11 w-full place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 active:bg-primary/80"
        href="/api/auth/google"
      >
        Google로 로그인
      </a>
      <p className="mt-4 text-center text-xs text-on-surface-variant">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="font-bold text-primary">
          시작하기
        </Link>
      </p>
      <p className="mt-6 text-center text-xs text-on-surface-variant">
        <Link href="/" className="hover:underline">
          지도로 돌아가기
        </Link>
      </p>
    </div>
  );
}
