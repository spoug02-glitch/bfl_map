"use client";

import { useEffect, useRef, useState } from "react";
import { labelPoint, sliceColor, sliceLabel, slicePath, spinTo } from "@/lib/roulette";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

type Props = {
  /** 후보 가게 이름들. 빈 배열이면 아직 아무도 안 담았다. */
  names: string[];
  /** 당첨 조각. null이면 아직 안 돌렸다. */
  winner: number | null;
  /** 원판이 멈췄는지. 상태는 부모가 든다 — 답을 언제 공개할지 정하는 쪽이다. */
  arrived: boolean;
  onArrive?: () => void;
};

const SIZE = 240;
const R = 112;
const C = SIZE / 2;
/** 돌아가는 시간(초). 짧으면 싱겁고 길면 지루하다. */
const SPIN_SEC = 3.4;

export default function RouletteWheel({ names, winner, arrived, onArrive }: Props) {
  const n = names.length;
  const reduced = usePrefersReducedMotion();
  // 회전각은 계속 쌓인다. 다시 돌릴 때 0으로 되감으면 무효처럼 보인다.
  const angleRef = useRef(0);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    if (winner === null || n === 0) return;
    angleRef.current = spinTo(n, winner, angleRef.current);
    setAngle(angleRef.current);
  }, [winner, n]);

  // transitionend는 안 올 수 있다 — 탭이 뒤에 있거나 브라우저가 합성을 멈춘
  // 경우다. 그 신호에만 기대면 "돌아가는 중…"에 영원히 갇힌다.
  useEffect(() => {
    if (winner === null || arrived || !onArrive) return;
    const t = setTimeout(onArrive, reduced ? 0 : SPIN_SEC * 1000 + 300);
    return () => clearTimeout(t);
  }, [winner, arrived, onArrive, reduced]);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, maxWidth: "100%" }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full"
        role="img"
        aria-label={
          arrived && winner !== null ? `룰렛 결과: ${names[winner]}` : "룰렛 원판"
        }
      >
        <g
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${C}px ${C}px`,
            // 처음엔 빠르게, 끝에서 천천히 — 멈추기 직전이 제일 조마조마하다
            transition: reduced ? "none" : `transform ${SPIN_SEC}s cubic-bezier(0.16, 0.84, 0.28, 1)`,
          }}
          onTransitionEnd={onArrive}
        >
          {n === 0 ? (
            // 아직 아무도 안 담았을 때. 회색 빈 원이 "여기가 채워질 자리"라고 말한다.
            <circle cx={C} cy={C} r={R} fill="var(--md-sys-color-surface-container)" />
          ) : (
            // key로 다시 마운트시켜, 후보가 늘 때마다 조각이 하나씩 앉는 게 보인다.
            // 랜덤으로 담았는데 직접 고른 줄 아는 오해가 여기서 풀린다.
            <g key={n} className="roulette-slices">
              {names.map((name, i) => {
                const start = (i * 360) / n;
                const end = ((i + 1) * 360) / n;
                const [lx, ly] = labelPoint(C, C, R, n, i);
                return (
                  <g key={i} style={{ animationDelay: `${i * 90}ms` }}>
                    <path d={slicePath(C, C, R, start, end)} fill={sliceColor(i)} />
                    <text
                      x={lx} y={ly}
                      textAnchor="middle" dominantBaseline="central"
                      className="fill-white text-[15px] font-bold"
                      // 조각과 함께 돌아가므로 글자도 같이 눕는다 — 원판을 도는
                      // 물체로 읽히게 하는 건 이 어긋남이다.
                    >
                      {sliceLabel(i)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {/* 가운데 축 */}
          <circle cx={C} cy={C} r={26} fill="var(--md-sys-color-surface-container-lowest)" />
        </g>

        {/* 바늘은 원판 밖에 있다 — 12시에 고정돼 돌지 않는다 */}
        <path
          d={`M ${C - 11} 6 L ${C + 11} 6 L ${C} 30 Z`}
          fill="var(--md-sys-color-primary)"
        />
      </svg>

      {/* 축 위의 글자. 원판과 같이 돌면 안 읽혀서 SVG 밖에 얹는다. */}
      <span
        className="pointer-events-none absolute grid place-items-center text-sm font-bold text-on-surface"
        style={{ inset: 0 }}
        aria-hidden
      >
        {n === 0 ? "0" : arrived && winner !== null ? sliceLabel(winner) : n}
      </span>
    </div>
  );
}
