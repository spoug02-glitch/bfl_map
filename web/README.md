This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database Setup

새로운 데이터베이스는 `schema.sql`을 실행하여 생성합니다. 기존 데이터베이스에서는 `migrations/2026-08-04-users-nickname.sql`을 정확히 한 번 실행해야 합니다.

**중요**: 마이그레이션은 새 코드 배포 **전에** 반드시 실행되어야 합니다. 배포 순서가 바뀌면 배포된 코드가 아직 없는 `users` 테이블을 조인하려다 500 오류가 발생합니다. 마이그레이션 파일 상단의 주의사항을 참고하세요 — 기존 `reviews.nickname`에 프로바이더 실명이 남아 있는 데이터베이스의 경우 추가 처리가 필요합니다.

데이터베이스 연결은 `DATABASE_URL` 환경 변수에서 가져옵니다 (`.env.example` 참고).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
