import { PLACE_ID_RE } from "@/lib/constants";

/**
 * "점심에 안 열어요" 제보.
 *
 * 왜 제보인가: 카카오 영업시간은 저작권 판단(37901fe7)으로 쓰지 않기로 했고,
 * 착한가격업소·인허가·공식 지역검색 API 어디에도 영업시간 필드가 없다.
 * 실제로 걸어갔다가 닫힌 문을 본 사람이 유일한 출처다.
 *
 * 왜 요일별 영업시간이 아니라 예/아니오인가: 여기서 답해야 하는 질문은
 * "점심에 갈 수 있나" 하나뿐이다. 주간 시간표를 받으면 제보는 어려워지고
 * 틀릴 자리만 늘어난다.
 */

/**
 * 이만큼 모여야 지도와 목록에서 뺀다.
 *
 * 1이면 한 사람이 멀쩡한 가게를 모두에게서 지울 수 있다. 특선 제보(lunch_specials)는
 * 하나여도 보여주지만 그건 **더하는** 정보라 틀려도 확인하면 그만이고, 이건
 * **빼는** 정보라 틀리면 그 가게는 아무에게도 안 보인다. 방향이 다르니 기준도 다르다.
 */
export const LUNCH_CLOSED_MIN_REPORTS = 2;

/** 가게별 제보 수. /api/lunch-closed 가 통째로 내려준다. */
export type ClosedCounts = Map<string, number>;

/** 점심에 안 여는 곳으로 확정됐는가. 제보가 모자라면 아직 아니다. */
export function closedAtLunch(counts: ClosedCounts, placeId: string): boolean {
  return (counts.get(placeId) ?? 0) >= LUNCH_CLOSED_MIN_REPORTS;
}

type Fail = { ok: false; error: string };
type Ok = { ok: true; placeId: string };

export function validatePlaceId(json: unknown): Fail | Ok {
  const o = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : null;
  if (!o || typeof o.placeId !== "string" || !PLACE_ID_RE.test(o.placeId)) {
    return { ok: false, error: "잘못된 가게 ID입니다." };
  }
  return { ok: true, placeId: o.placeId };
}
