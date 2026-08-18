import { PLACE_ID_RE } from "@/lib/constants";

/** /contact 가 이메일로 받던 목록에서 그대로 온 네 종류. DB CHECK 제약과 같은 집합이다. */
export const REPORT_KINDS = ["place_fix", "delist", "abuse", "feature"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  place_fix: "가게 정보가 달라요 (폐업·이전·가격)",
  delist: "가게 노출을 원하지 않아요",
  abuse: "부적절한 리뷰·제보 신고",
  feature: "기능 제안·불편",
};

export const BODY_MAX = 1000;
export const CONTACT_MAX = 120;
/** 업주가 한 번에 올릴 수 있는 메뉴 줄. 이보다 많으면 메뉴판을 통째로 붙여넣은 것이다. */
export const OWNER_MENU_MAX = 20;
export const MENU_NAME_MAX = 40;
/** 점심 메뉴가 이 밖이면 오타다. lib/specials.ts 의 제보 검증과 같은 기준을 쓴다. */
export const PRICE_MIN = 500;
export const PRICE_MAX = 100_000;

export type ReportInput = {
  kind: ReportKind;
  placeId: string | null;
  body: string;
  contact: string | null;
};

export type OwnerMenuInput = {
  placeId: string;
  /** 업주 연락처는 필수다 — 승인 전에 확인할 일이 생긴다. */
  contact: string;
  menus: { menuName: string; price: number }[];
};

type Fail = { ok: false; error: string };
type Ok<T> = { ok: true; value: T };

function asRecord(json: unknown): Record<string, unknown> | null {
  return typeof json === "object" && json !== null ? (json as Record<string, unknown>) : null;
}

/**
 * 봇이 채우면 버리는 칸. 사람에게는 숨겨져 있어 비어 있는 게 정상이다.
 *
 * 비로그인으로 받는 폼이라 계정으로 막을 수단이 없다. 완전한 방어는 아니지만
 * 값이 싸고, 무엇보다 사람에게 통행료를 물리지 않는다 — CAPTCHA 를 안 쓰는 이유다.
 */
export function looksLikeBot(json: unknown): boolean {
  const o = asRecord(json);
  return typeof o?.website === "string" && o.website.trim() !== "";
}

export function validateReportInput(json: unknown): Fail | Ok<ReportInput> {
  const o = asRecord(json);
  if (!o) return { ok: false, error: "잘못된 요청입니다." };

  if (typeof o.kind !== "string" || !REPORT_KINDS.includes(o.kind as ReportKind)) {
    return { ok: false, error: "어떤 내용인지 골라주세요." };
  }
  const kind = o.kind as ReportKind;

  if (typeof o.body !== "string" || o.body.trim().length === 0) {
    return { ok: false, error: "내용을 적어주세요." };
  }
  const body = o.body.trim();
  if (body.length > BODY_MAX) {
    return { ok: false, error: `내용은 ${BODY_MAX}자까지예요.` };
  }

  // 가게는 선택이다. 가게와 무관한 제보도 있고, 이름을 본문에 적는 사람도 있다.
  let placeId: string | null = null;
  if (o.placeId !== undefined && o.placeId !== null && o.placeId !== "") {
    if (typeof o.placeId !== "string" || !PLACE_ID_RE.test(o.placeId)) {
      return { ok: false, error: "잘못된 요청입니다." };
    }
    placeId = o.placeId;
  }

  let contact: string | null = null;
  if (o.contact !== undefined && o.contact !== null) {
    if (typeof o.contact !== "string") return { ok: false, error: "잘못된 요청입니다." };
    const t = o.contact.trim();
    if (t.length > CONTACT_MAX) {
      return { ok: false, error: `연락처는 ${CONTACT_MAX}자까지예요.` };
    }
    if (t.length > 0) contact = t;
  }

  return { ok: true, value: { kind, placeId, body, contact } };
}

export function validateOwnerMenuInput(json: unknown): Fail | Ok<OwnerMenuInput> {
  const o = asRecord(json);
  if (!o) return { ok: false, error: "잘못된 요청입니다." };

  if (typeof o.placeId !== "string" || !PLACE_ID_RE.test(o.placeId)) {
    return { ok: false, error: "가게를 골라주세요." };
  }
  // 제보와 달리 업주 연락처는 필수다. 승인 전에 확인할 일이 생긴다.
  if (typeof o.contact !== "string" || o.contact.trim().length === 0) {
    return { ok: false, error: "연락처를 적어주세요. 확인이 필요할 때 연락드려요." };
  }
  const contact = o.contact.trim();
  if (contact.length > CONTACT_MAX) {
    return { ok: false, error: `연락처는 ${CONTACT_MAX}자까지예요.` };
  }

  if (!Array.isArray(o.menus) || o.menus.length === 0) {
    return { ok: false, error: "메뉴를 한 줄 이상 적어주세요." };
  }
  if (o.menus.length > OWNER_MENU_MAX) {
    return { ok: false, error: `한 번에 ${OWNER_MENU_MAX}개까지 올릴 수 있어요.` };
  }

  const menus: { menuName: string; price: number }[] = [];
  for (const raw of o.menus) {
    const m = asRecord(raw);
    if (!m) return { ok: false, error: "잘못된 요청입니다." };
    if (typeof m.menuName !== "string" || m.menuName.trim().length === 0) {
      return { ok: false, error: "메뉴 이름을 적어주세요." };
    }
    const menuName = m.menuName.trim();
    if (menuName.length > MENU_NAME_MAX) {
      return { ok: false, error: `메뉴 이름은 ${MENU_NAME_MAX}자까지예요.` };
    }
    if (typeof m.price !== "number" || !Number.isInteger(m.price)) {
      return { ok: false, error: `'${menuName}' 가격을 숫자로 적어주세요.` };
    }
    if (m.price < PRICE_MIN || m.price > PRICE_MAX) {
      return { ok: false, error: `'${menuName}' 가격을 다시 확인해주세요.` };
    }
    menus.push({ menuName, price: m.price });
  }

  return { ok: true, value: { placeId: o.placeId, contact, menus } };
}
