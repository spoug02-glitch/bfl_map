"use client";

import { useEffect, useState } from "react";
import { LADDER_ROWS, followLeg, type Ladder } from "@/lib/ladder";

type Props = {
  ladder: Ladder;
  /** 아래쪽에 걸린 가게 이름들. 위쪽은 번호만 있는 출발 자리다. */
  names: string[];
  /** 도착한 자리. null이면 아직 안 골랐다. */
  winner: number | null;
  /** 어느 자리에서 출발했는지. 공유 링크로 들어오면 서버가 역산해 넘겨준다. */
  start: number | null;
  onPick?: (leg: number) => void;
};

const COL = 60;
const ROW = 24;
const PAD = 14;

/** 한 줄을 타고 내려간 자취. 애니메이션이 이 선을 따라 그려진다. */
function tracePath(ladder: Ladder, start: number): string {
  let pos = start;
  let d = `M ${PAD + pos * COL} ${PAD}`;
  ladder.forEach((row, r) => {
    const y = PAD + (r + 1) * ROW;
    d += ` L ${PAD + pos * COL} ${y}`;
    if (row[pos]) pos += 1;
    else if (pos > 0 && row[pos - 1]) pos -= 1;
    else return;
    d += ` L ${PAD + pos * COL} ${y}`;
  });
  return d + ` L ${PAD + pos * COL} ${PAD + (LADDER_ROWS + 1) * ROW}`;
}

export default function LadderBoard({ ladder, names, winner, start, onPick }: Props) {
  const legs = names.length;
  const width = PAD * 2 + (legs - 1) * COL;
  const height = PAD * 2 + (LADDER_ROWS + 1) * ROW;
  const boardStyle = { width: Math.max(width, 240), maxWidth: "100%" };

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
        aria-label={winner === null ? "사다리" : `사다리 결과: ${names[winner]}`}
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
        {start !== null && (
          <path
            // key로 다시 마운트시켜 출발 자리가 바뀔 때마다 애니메이션이 새로 돈다.
            key={start}
            d={tracePath(ladder, start)}
            fill="none"
            stroke="var(--color-star)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 2000,
              animation: "ladder-trace 1.4s ease-out forwards",
            }}
          />
        )}
      </svg>

      {/* 도착 자리 — 걸린 가게들 */}
      <div className="flex items-start" style={boardStyle}>
        {names.map((name, i) => (
          <span
            key={i}
            className={`min-w-0 flex-1 break-keep px-1 text-center text-xs leading-tight ${
              winner === i ? "font-bold text-text-primary" : "text-text-muted"
            }`}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
