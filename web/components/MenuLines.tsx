import { SPECIAL_DISCLAIMER, SpecialPrice, formatPrice } from "@/lib/constants";

/**
 * 뽑힌 가게가 뭘 파는지 보여준다. 카카오 메뉴 수집이 저작권 문제로 중단된 뒤로는
 * 제보받은 점심특선뿐이다 — 특선이 없으면 보여줄 게 없다.
 */
export default function MenuLines({
  special,
}: { special?: SpecialPrice }) {
  if (!special) {
    return <p className="text-xs text-on-surface-variant">메뉴 정보가 없어요</p>;
  }

  return (
    <ul className="space-y-0.5 text-xs">
      <li className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-on-surface">
          {/* 별색으로 칠한 글자였는데, 그 색(#c85300)은 아이콘 기준 3:1 에 맞춘 값이라
              작은 텍스트로는 대비가 모자랐다(카드 위 3.86:1). 더 어둡게 하면 가격색과
              구분이 사라진다. 출처를 밝히는 표시라는 원래 역할대로 배지로 바꿨다 —
              tertiary 는 "본류와 다른 갈래"를 뜻하는 자리라 제보 출처에 맞는다. */}
          <span className="rounded bg-tertiary-container px-1 py-0.5 text-[10px] font-bold text-on-tertiary-container">특선</span>{" "}
          {special.menuName}
        </span>
        <span className="shrink-0 text-price">{formatPrice(String(special.price))}</span>
      </li>
      <li className="text-[11px] leading-tight text-on-surface-variant">{SPECIAL_DISCLAIMER}</li>
    </ul>
  );
}
