import Link from "next/link";

// /login과 이 페이지는 버튼이 같은 곳(/api/auth/google)을 가리킨다 — 구글
// 로그인은 첫 방문이면 자동으로 계정을 만들고, 다음부터는 그대로 로그인이다.
// 이유는 app/login/page.tsx 상단 주석 참고.
export default function SignupPage() {
  return (
    <div className="mx-auto mt-24 max-w-xs px-6">
      <h1 className="text-lg font-bold text-on-surface">시작하기</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        구글 계정으로 시작하면 바로 리뷰를 남기고 가게를 저장할 수 있어요.
      </p>
      <a
        className="mt-6 grid h-11 w-full place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 active:bg-primary/80"
        href="/api/auth/google"
      >
        Google로 시작하기
      </a>
      <p className="mt-4 text-center text-xs text-on-surface-variant">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-bold text-primary">
          로그인
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
