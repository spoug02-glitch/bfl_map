import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { validateNickname } from "@/lib/nickname";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const RENAME_COOLDOWN_DAYS = 30;
const RENAME_COOLDOWN_MS = RENAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function isDuplicateNickname(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const raw =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>).nickname
      : undefined;
  const v = validateNickname(raw);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const [me] = await sql`
    SELECT nickname, created_at, updated_at FROM users WHERE user_id = ${session.userId}`;

  if (me) {
    // 같은 이름을 다시 저장하는 건 개명이 아니다. 확인 버튼 두 번 누른 사람이
    // 한 달치 변경 기회를 날리면 안 된다.
    if (me.nickname === v.value) {
      return NextResponse.json({ nickname: me.nickname });
    }
    // created_at과 updated_at이 같으면 처음 정한 뒤 한 번도 안 바꾼 상태다.
    // 자동 제안 이름을 얼떨결에 확정한 사람에게 한 번은 무르게 해준다.
    const neverRenamed = +new Date(me.created_at) === +new Date(me.updated_at);
    if (!neverRenamed) {
      const nextAllowed = new Date(+new Date(me.updated_at) + RENAME_COOLDOWN_MS);
      if (Date.now() < nextAllowed.getTime()) {
        return NextResponse.json(
          {
            error: `닉네임은 ${RENAME_COOLDOWN_DAYS}일에 한 번만 바꿀 수 있어요. ${kstDate(nextAllowed)}부터 가능해요.`,
          },
          { status: 429 },
        );
      }
    }
  }

  try {
    await sql`
      INSERT INTO users (user_id, nickname) VALUES (${session.userId}, ${v.value})
      ON CONFLICT (user_id)
      DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = now()`;
  } catch (e) {
    // 중복 판정은 users_nickname_lower_key 인덱스에 맡긴다. 미리 SELECT로
    // 확인하면 두 사람이 동시에 같은 이름을 넣을 때 둘 다 통과해버린다.
    if (isDuplicateNickname(e)) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임이에요." }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ nickname: v.value });
}
