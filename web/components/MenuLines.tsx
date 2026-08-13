import { SPECIAL_DISCLAIMER, SpecialPrice, formatPrice } from "@/lib/constants";

/**
 * 뽑힌 가게가 뭘 파는지 몇 줄로 보여준다. 이름만 나오면 "거기가 뭐 하는 데더라"로
 * 이어져 결국 카카오맵을 다시 열게 된다.
 *
 * 가격이 없는 메뉴는 아예 뺀다 — 카카오가 미공개를 -1로 주기 때문에 그대로 쓰면
 * 없는 가격을 지어내는 꼴이 된다. 수집분 기준 150m 안 밥집의 3분의 1은 가격이 없다.
 */
export default function MenuLines({
  menus, special, max = 3,
}: { menus: { name: string; price: string }[]; special?: SpecialPrice; max?: number }) {
  const priced = menus
    .map(m => ({ name: m.name, price: formatPrice(m.price) }))
    .filter((m): m is { name: string; price: string } => m.price !== null)
    .slice(0, max);

  if (priced.length === 0 && !special) {
    return <p className="text-xs text-text-muted">메뉴 정보가 없어요</p>;
  }

  return (
    <ul className="space-y-0.5 text-xs">
      {/* 제보받은 점심특선이 있으면 맨 위에, 출처가 보이게 "특선"을 달고 */}
      {special && (
        <>
          <li className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-text-primary">
              <span className="font-bold text-star">특선</span> {special.menuName}
            </span>
            <span className="shrink-0 text-price">{formatPrice(String(special.price))}</span>
          </li>
          <li className="text-[11px] leading-tight text-text-muted">{SPECIAL_DISCLAIMER}</li>
        </>
      )}
      {priced.map(m => (
        <li key={m.name} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-text-primary">{m.name}</span>
          <span className="shrink-0 text-price">{m.price}</span>
        </li>
      ))}
    </ul>
  );
}
