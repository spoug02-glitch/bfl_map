/**
 * 룰렛 원판의 기하와 회전.
 *
 * 사다리를 대신한다. 사다리타기의 재미는 여러 명이 각자 자리를 고르고 같이
 * 지켜보는 데서 나오는데, 우리 건 한 명이 가게 하나를 뽑는 1인용이라 세로줄도
 * 가로줄도 아무 일을 하지 않는 장식이었다. 룰렛은 그 형식에 맞는다 —
 * 후보가 곧 조각이고, 한 번 돌리면 끝난다.
 */

/**
 * 조각 색. 후보가 몇이든 서로 구별돼야 해서 색상환을 한 바퀴 돈다.
 * 흰 글자를 얹어도 읽히는 명도로 고른 값들이다.
 */
export const SLICE_COLORS = [
  "#e5484d", // 빨
  "#f76b15", // 주
  "#e0a800", // 노 (원색 노랑은 흰 글자가 안 읽혀 한 단계 어둡게)
  "#46a758", // 초
  "#12a594", // 청록
  "#0091ff", // 파
  "#3e63dd", // 남
  "#8e4ec6", // 보
];

/** 조각 이름. 가게 이름은 길어서 원판 안에 못 넣는다 — 글자 하나로 부른다. */
export const SLICE_LABELS = "ABCDEFGH";

export function sliceColor(i: number): string {
  return SLICE_COLORS[i % SLICE_COLORS.length];
}

export function sliceLabel(i: number): string {
  return SLICE_LABELS[i % SLICE_LABELS.length];
}

/** 12시에서 시계방향으로 잰 조각 한가운데의 각도. */
export function sliceCenterDeg(n: number, i: number): number {
  return (i + 0.5) * (360 / n);
}

/**
 * 12시에 고정된 바늘이 당첨 조각을 가리키게 하는 총 회전각.
 *
 * `from`보다 반드시 크다 — 다시 돌릴 때 뒤로 감기면 "무효" 같아 보인다.
 * 항상 앞으로만, 최소 `turns`바퀴를 더 돌고 멈춘다.
 */
export function spinTo(n: number, winner: number, from: number, turns = 4): number {
  const base = from + turns * 360;
  // 조각 중앙을 12시로 보내려면 그만큼 거꾸로 돌려야 한다
  const target = -sliceCenterDeg(n, winner);
  const delta = (((target - base) % 360) + 360) % 360;
  return base + delta;
}

function pointOnCircle(cx: number, cy: number, r: number, deg: number): [number, number] {
  // SVG의 0°는 3시 방향이라 12시로 옮긴다
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** 부채꼴 하나의 path. 후보는 2곳 이상이라 한 조각이 360°가 되는 경우는 없다. */
export function slicePath(
  cx: number, cy: number, r: number, startDeg: number, endDeg: number,
): string {
  const [x1, y1] = pointOnCircle(cx, cy, r, startDeg);
  const [x2, y2] = pointOnCircle(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} ` +
    `A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

/** 조각 위에 글자를 앉힐 자리 — 중심과 테두리 사이. */
export function labelPoint(cx: number, cy: number, r: number, n: number, i: number): [number, number] {
  return pointOnCircle(cx, cy, r * 0.62, sliceCenterDeg(n, i));
}
