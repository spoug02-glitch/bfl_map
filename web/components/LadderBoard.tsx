"use client";

import { useEffect, useRef, useState } from "react";
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

const ROW = 24;
const PAD = 14;
/**
 * 칸 폭의 허용 범위. 좁은 쪽은 이름이 세로로 너무 길게 쌓이지 않는 하한이고,
 * 넓은 쪽은 후보 둘짜리 사다리가 패널을 통째로 차지하지 않는 상한이다.
 * 실제 값은 컨테이너 폭을 재서 그 사이에서 정한다 — 60px 고정으로 두면 후보가
 * 적을 때 오른쪽이 텅 비고, 많을 때는 가로 스크롤이 생긴다.
 */
const COL_MIN = 44;
const COL_MAX = 110;
const COL_FALLBACK = 60; // 폭을 재기 전(서버 렌더 포함) 한 프레임용

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
function trace(ladder: Ladder, start: number, col: number): Trace {
  let pos = start;
  let d = `M ${PAD + pos * col} ${PAD}`;
  let length = 0;
  ladder.forEach((row, r) => {
    const y = PAD + (r + 1) * ROW;
    d += ` L ${PAD + pos * col} ${y}`;
    length += ROW;
    if (row[pos]) pos += 1;
    else if (pos > 0 && row[pos - 1]) pos -= 1;
    else return;
    d += ` L ${PAD + pos * col} ${y}`;
    length += col;
  });
  return { d: `${d} L ${PAD + pos * col} ${PAD + (LADDER_ROWS + 1) * ROW}`, length: length + ROW };
}

export default function LadderBoard({
  ladder, names, winner, start, arrived, onPick, onArrive,
}: Props) {
  const legs = names.length;

  // 컨테이너 폭에 맞춰 칸 폭을 정한다. 서버는 폭을 모르니 한 프레임은 기본값으로
  // 그려지고, 붙는 즉시 관찰자가 실측으로 바로잡는다.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState<number | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWrapW(el.clientWidth);
    // 초기 한 번은 타이머로 잰다. ResizeObserver 배달은 렌더링 루프에 실려서,
    // 화면을 그리지 않는 창(백그라운드 웹뷰 등)에서는 영영 안 올 수 있다.
    // 레이아웃 계산은 그런 창에서도 되므로 타이머는 항상 돈다.
    const t = setTimeout(measure, 0);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, []);
  const col = wrapW === null
    ? COL_FALLBACK
    : Math.max(COL_MIN, Math.min(COL_MAX, (wrapW - PAD * 2) / (legs - 1)));

  const width = PAD * 2 + (legs - 1) * col;
  const height = PAD * 2 + (LADDER_ROWS + 1) * ROW;
  // 상한에 걸려 컨테이너보다 좁으면 가운데로 — 왼쪽에 몰리면 오른쪽이 버려진다.
  const boardStyle = { width, maxWidth: "100%", margin: "0 auto" };

  // 선을 멈추는 건 globals.css가 한다(하이드레이션 전부터 필요해서다). 여기서 이
  // 설정을 다시 읽는 건 답을 여는 시점 때문이다 — 기다릴 애니메이션이 없는데
  // 아래 대비 타이머만 3초를 세고 있으면 결과를 못 보고 앉아 있게 된다.
  const reduced = usePrefersReducedMotion();
  const path = start === null ? null : trace(ladder, start, col);
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
    <div ref={wrapRef} className="overflow-x-auto">
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

      {/* 출발 전에는 사다리 대신 덮개 판이다. 세로줄만 덩그러니 있으면 덜 그려진
          화면처럼 읽힌다 — 가로줄을 감춰야 하는 이유(답이 보인다)는 그대로이니,
          아예 판으로 덮고 판 자체를 시작 버튼으로 쓴다. 자리는 아무거나 골라도
          공평해서, 번호를 직접 누르는 길도 위에 남겨둔다. */}
      {start === null && onPick ? (
        <button
          className="grid place-items-center rounded-xl bg-surface-muted"
          style={{ ...boardStyle, height }}
          onClick={() => onPick(Math.floor(Math.random() * legs))}
        >
          <span className="grid place-items-center gap-2 text-sm font-bold text-text-primary">
            <span aria-hidden className="text-3xl">🪜</span>
            누르면 사다리 타기가 시작돼요
          </span>
        </button>
      ) : (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={boardStyle}
        role="img"
        aria-label={arrived && winner !== null ? `사다리 결과: ${names[winner]}` : "사다리"}
      >
        {Array.from({ length: legs }, (_, i) => (
          <line
            key={i}
            x1={PAD + i * col} y1={PAD}
            x2={PAD + i * col} y2={PAD + (LADDER_ROWS + 1) * ROW}
            stroke="var(--color-border)" strokeWidth="3" strokeLinecap="round"
          />
        ))}
        {/* 가로줄은 출발을 고른 뒤에야 놓인다. 미리 보여주면 눈으로 따라가
            원하는 가게에 닿는 자리를 골라 시작할 수 있다 — 답이 보이는 사다리는
            사다리가 아니다. */}
        {start !== null && (
          <g className="ladder-rungs">
            {ladder.map((row, r) =>
              row.map((on, g) =>
                on ? (
                  <line
                    key={`${r}-${g}`}
                    x1={PAD + g * col} y1={PAD + (r + 1) * ROW}
                    x2={PAD + (g + 1) * col} y2={PAD + (r + 1) * ROW}
                    stroke="var(--color-border)" strokeWidth="3" strokeLinecap="round"
                  />
                ) : null,
              ),
            )}
          </g>
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
      )}

      {/* 도착 자리 — 선이 닿기 전에는 어느 것도 강조하지 않는다 */}
      <div className="flex items-start" style={boardStyle}>
        {names.map((name, i) => {
          const hit = arrived && winner === i;
          return (
            <span
              key={i}
              // break-keep만 두면 띄어쓰기 없는 긴 이름("본죽&비빔밥cafe")이 옆
              // 칸을 뚫고 나간다. anywhere가 그런 토큰만 칸 안에서 꺾어준다.
              className={`min-w-0 flex-1 break-keep px-1 text-center text-xs leading-tight [overflow-wrap:anywhere] ${
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
