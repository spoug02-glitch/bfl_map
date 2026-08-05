/**
 * 사다리 그림과 경로.
 *
 * 그림은 seed에서 통째로 재현된다. 링크에 seed만 담으면 누가 열어도 같은 사다리를
 * 보게 되고, 결과가 링크와 어긋날 일이 없다.
 */

/** 가로줄이 놓일 수 있는 단 수. 너무 적으면 뻔하고, 많으면 화면에서 뭉갠다. */
export const LADDER_ROWS = 10;

/** row[i]가 true면 i번과 i+1번 세로줄 사이에 가로줄이 있다. */
export type Ladder = boolean[][];

/** 작고 결정적인 난수. Math.random을 쓰면 seed로 재현할 수가 없다. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLadder(legs: number, seed: number): Ladder {
  const rand = mulberry32(seed);
  const gaps = legs - 1;
  const rows: Ladder = [];

  for (let r = 0; r < LADDER_ROWS; r++) {
    const row: boolean[] = new Array(gaps).fill(false);
    for (let g = 0; g < gaps; g++) {
      // 바로 왼쪽에 이미 가로줄이 있으면 건너뛴다. 두 개가 붙으면 어느 쪽으로
      // 건너야 하는지가 모호해져 사다리가 아니게 된다.
      if (g > 0 && row[g - 1]) continue;
      if (rand() < 0.4) row[g] = true;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * 세로줄 하나를 끝까지 타고 내려가 도착 자리를 돌려준다.
 *
 * 범위 밖 값은 -1을 돌려준다. 그냥 통과시키면 -1을 넣었을 때 -1이 그대로 나와
 * "당첨 -1번"이라는 그럴듯한 값이 되고, 호출부가 그걸 배열 인덱스로 쓴다.
 */
export function followLeg(ladder: Ladder, start: number): number {
  const legs = (ladder[0]?.length ?? 0) + 1;
  if (!Number.isInteger(start) || start < 0 || start >= legs) return -1;
  let pos = start;
  for (const row of ladder) {
    if (row[pos]) pos += 1;
    else if (pos > 0 && row[pos - 1]) pos -= 1;
  }
  return pos;
}
