"use client";

import { useEffect } from "react";
import { LADDER_ROWS, type Ladder } from "@/lib/ladder";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

type Props = {
  ladder: Ladder;
  /** 아래쪽에 걸린 가게 이름들. 위쪽은 번호만 있는 출발 자리다. */
  names: string[];
  /** 도착한 자리. null이면 아직 안 골랐다. */
  winner: number | null;
  /** 어느 자리에서 출발했는지. 공유 링크로 들어오면 서버가 역산해 넘겨준다. */
  start: number | null;
  /** 선이 바닥에 닿았는지. 상태는 부모가 들고 있다 — 답을 언제 공개할지 정하는 쪽이다. */
  arrived: boolean;
  onPick?: (leg: number) => void;
  onArrive?: () => void;
};

const COL = 60;
const ROW = 24;
const PAD = 14;

/**
 * 선이 내려가는 속도(초당 픽셀). 시간을 고정하면 후보가 많을수록 선이 빨라져
 * 사다리마다 체감이 달라진다 — 길이에 비례해 시간을 정해 속도를 일정하게 둔다.
 */
const TRACE_SPEED = 190;

type Trace = { d: string; length: number };

/**
 * 한 줄을 타고 내려간 자취와 그 길이.
 *
 * 길이는 DOM에 묻지 않고 직접 센다(getTotalLength). 그래야 렌더 전에 재생 시간을
 * 알 수 있고, 애니메이션이 끝났다는 신호가 오지 않을 때 쓸 대비 시간도 계산된다.
 */
function trace(ladder: Ladder, start: number): Trace {
  let pos = start;
  let d = `M ${PAD + pos * COL} ${PAD}`;
  let length = 0;
  ladder.forEach((row, r) => {
    const y = PAD + (r + 1) * ROW;
    d += ` L ${PAD + pos * COL} ${y}`;
    length += ROW;
    if (row[pos]) pos += 1;
    else if (pos > 0 && row[pos - 1]) pos -= 1;
    else return;
    d += ` L ${PAD + pos * COL} ${y}`;
    length += COL;
  });
  return { d: `${d} L ${PAD + pos * COL} ${PAD + (LADDER_ROWS + 1) * ROW}`, length: length + ROW };
}

export default function LadderBoard({
  ladder, names, winner, start, arrived, onPick, onArrive,
}: Props) {
  const legs = names.length;
  const width = PAD * 2 + (legs - 1) * COL;
  const height = PAD * 2 + (LADDER_ROWS + 1) * ROW;
  const boardStyle = { width: Math.max(width, 240), maxWidth: "100%" };

  // 선을 멈추는 건 globals.css가 한다(하이드레이션 전부터 필요해서다). 여기서 이
  // 설정을 다시 읽는 건 답을 여는 시점 때문이다 — 기다릴 애니메이션이 없는데
  // 아래 대비 타이머만 3초를 세고 있으면 결과를 못 보고 앉아 있게 된다.
  const reduced = usePrefersReducedMotion();
  const path = start === null ? null : trace(ladder, start);
  const seconds = path && !reduced ? path.length / TRACE_SPEED : 0;

  // animationend는 안 올 수 있다 — 탭이 뒤로 가 있거나, 애니메이션이 중간에
  // 갈아치워지거나, 브라우저가 합성을 멈춘 경우다. 그 신호에만 기대면 사용자는
  // "내려가는 중…"에 영원히 갇힌다. 예상 시간이 지나면 그냥 공개한다.
  useEffect(() => {
    if (start === null || arrived || !onArrive) return;
    const t = setTimeout(onArrive, seconds * 1000 + (reduced ? 0 : 400));
    return () => clearTimeout(t);
  }, [start, arrived, onArrive, seconds, reduced]);

  return (
    <div className="overflow-x-auto">
      {/* 출발 자리 — 고르기 전에는 여기를 누른다 */}
      <div className="flex" style={boardStyle}>
        {Array.from({ length: legs }, (_, i) => (
          <button
            key={i}
            className={`min-w-0 flex-1 rounded-lg py-2 text-sm font-bold ${
              start === i ? "bg-ink text-white" : "bg-surface-muted text-text-primary"
            } disabled:opacity-60`}
            disabled={start !== null || !onPick}
            aria-label={`${i + 1}번 자리에서 출발`}
            onClick={() => onPick?.(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={boardStyle}
        role="img"
        aria-label={arrived && winner !== null ? `사다리 결과: ${names[winner]}` : "사다리"}
      >
        {Array.from({ length: legs }, (_, i) => (
          <line
            key={i}
            x1={PAD + i * COL} y1={PAD}
            x2={PAD + i * COL} y2={PAD + (LADDER_ROWS + 1) * ROW}
            stroke="var(--color-border)" strokeWidth="3" strokeLinecap="round"
          />
        ))}
        {ladder.map((row, r) =>
          row.map((on, g) =>
            on ? (
              <line
                key={`${r}-${g}`}
                x1={PAD + g * COL} y1={PAD + (r + 1) * ROW}
                x2={PAD + (g + 1) * COL} y2={PAD + (r + 1) * ROW}
                stroke="var(--color-border)" strokeWidth="3" strokeLinecap="round"
              />
            ) : null,
          ),
        )}
        {path && (
          <path
            // key로 다시 마운트시켜 출발 자리가 바뀔 때마다 처음부터 그려진다.
            key={start}
            // globals.css가 이 이름으로 잡아서, 움직임을 줄여달라고 한 사람에게는
            // 자바스크립트가 붙기 전부터 시간을 0으로 눌러둔다.
            className="ladder-trace"
            d={path.d}
            fill="none"
            stroke="var(--color-star)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: path.length,
              strokeDashoffset: path.length,
              // linear로 둔다. ease-out은 처음에 확 나가고 끝에서 기어가 김이 빠진다.
              animation: `ladder-trace ${seconds.toFixed(2)}s linear forwards`,
            }}
            onAnimationEnd={onArrive}
          />
        )}
      </svg>

      {/* 도착 자리 — 선이 닿기 전에는 어느 것도 강조하지 않는다 */}
      <div className="flex items-start" style={boardStyle}>
        {names.map((name, i) => {
          const hit = arrived && winner === i;
          return (
            <span
              key={i}
              className={`min-w-0 flex-1 break-keep px-1 text-center text-xs leading-tight ${
                hit ? "font-bold text-text-primary" : "text-text-muted"
              }`}
              style={hit ? { animation: "ladder-land 0.45s ease-out" } : undefined}
            >
              {name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
