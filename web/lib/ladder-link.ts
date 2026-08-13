import { PLACE_ID_RE } from "@/lib/constants";

/**
 * 사다리 결과는 DB에 저장하지 않고 링크 자체에 담는다. 테이블도, 만료 관리도,
 * 개인정보 처리방침에 더할 항목도 생기지 않는다 — 결과는 그저 "후보와 당첨"이라
 * 누구 것인지 알 필요가 없다.
 *
 * 가게 이름은 넣지 않는다. 이름은 restaurants.json에 있고 클라이언트가 이미
 * 들고 있으므로, 링크에는 짧은 숫자 id만 담아 주소가 부풀지 않게 한다.
 */
export type LadderDraw = {
  placeIds: string[];
  /** placeIds에서 당첨된 자리 */
  winner: number;
  /** 가로줄 배치를 재현하는 값. 같은 링크는 늘 같은 사다리를 그린다. */
  seed: number;
};

export const MIN_LEGS = 2;
/** 세로줄이 이보다 많으면 좁은 화면에서 선이 붙어 눈으로 못 따라간다. */
export const MAX_LEGS = 8;

/** 링크에 실리는 모양. 키를 한 글자로 줄여 주소를 짧게 유지한다. */
type Wire = { p: string[]; w: number; s: number };

function toBase64Url(s: string): string {
  const b64 = typeof btoa === "function"
    ? btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    : Buffer.from(s, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  try {
    if (typeof atob === "function") {
      const bin = atob(b64);
      return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    }
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function encodeLadder(draw: LadderDraw): string {
  const wire: Wire = { p: draw.placeIds, w: draw.winner, s: draw.seed };
  return toBase64Url(JSON.stringify(wire));
}

/**
 * 링크는 누구나 만들어 보낼 수 있다. 모양이 맞는지 전부 확인하고, 하나라도
 * 어긋나면 null을 돌려 호출부가 "못 읽는 링크" 화면으로 떨어지게 한다.
 */
export function decodeLadder(token: string): LadderDraw | null {
  const json = fromBase64Url(token);
  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { p, w, s } = parsed as Record<string, unknown>;

  if (!Array.isArray(p) || p.length < MIN_LEGS || p.length > MAX_LEGS) return null;
  if (!p.every(id => typeof id === "string" && PLACE_ID_RE.test(id))) return null;
  if (new Set(p).size !== p.length) return null;
  if (typeof w !== "number" || !Number.isInteger(w) || w < 0 || w >= p.length) return null;
  if (typeof s !== "number" || !Number.isFinite(s)) return null;

  return { placeIds: p as string[], winner: w, seed: s };
}
