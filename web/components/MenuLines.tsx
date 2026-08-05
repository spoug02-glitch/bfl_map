import { formatPrice } from "@/lib/constants";

/**
 * 뽑힌 가게가 뭘 파는지 몇 줄로 보여준다. 이름만 나오면 "거기가 뭐 하는 데더라"로
 * 이어져 결국 카카오맵을 다시 열게 된다.
 *
 * 가격이 없는 메뉴는 아예 뺀다 — 카카오가 미공개를 -1로 주기 때문에 그대로 쓰면
 * 없는 가격을 지어내는 꼴이 된다. 수집분 기준 150m 안 밥집의 3분의 1은 가격이 없다.
 */
export default function MenuLines({
  menus, max = 3,
}: { menus: { name: string; price: string }[]; max?: number }) {
  const priced = menus
    .map(m => ({ name: m.name, price: formatPrice(m.price) }))
    .filter((m): m is { name: string; price: string } => m.price !== null)
    .slice(0, max);

  if (priced.length === 0) {
    return <p className="text-xs text-text-muted">메뉴 정보가 없어요</p>;
  }

  return (
    <ul className="space-y-0.5 text-xs">
      {priced.map(m => (
        <li key={m.name} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-text-primary">{m.name}</span>
          <span className="shrink-0 text-price">{m.price}</span>
        </li>
      ))}
    </ul>
  );
}
