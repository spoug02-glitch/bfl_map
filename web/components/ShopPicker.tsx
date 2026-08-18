"use client";

import { useRef, useState } from "react";
import type { Restaurant } from "@/lib/constants";

type Picked = { placeId: string; name: string } | null;

/**
 * 가게 한 곳을 골라 place_id 로 바꿔주는 입력칸.
 *
 * 목록을 페이지가 뜰 때 받아오지 않는다. /restaurants.json 은 2.6MB 라서,
 * 제보하러 온 사람 대부분이 가게 칸을 건드리지도 않는데 모두에게 그 값을 물리게 된다.
 * 첫 타이핑에서만 한 번 받아오고 그 뒤로는 메모리에서 거른다.
 */
export default function ShopPicker({
  label, required = false, value, onChange,
}: {
  label: string;
  required?: boolean;
  value: Picked;
  onChange: (v: Picked) => void;
}) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState<Restaurant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  const load = () => {
    if (started.current) return;
    started.current = true;
    setLoading(true);
    fetch("/restaurants.json")
      .then(r => r.json())
      .then((d: Restaurant[]) => setAll(d))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  const typed = (next: string) => {
    setQuery(next);
    // 이미 고른 뒤에 글자를 고치면 그 선택은 더 이상 화면과 맞지 않는다.
    if (value) onChange(null);
    if (next.trim().length > 0) load();
  };

  const q = query.trim();
  // 이름 대신 search_keys 로 찾는다 — "씨유"로 저장된 가게를 "CU"로 찾게 하는 게
  // 그 배열이 존재하는 이유다(lib/constants.ts 의 Restaurant 주석).
  const matches =
    q.length === 0 || all === null
      ? []
      : all.filter(r => r.search_keys.some(k => k.includes(q))).slice(0, 8);

  return (
    <div>
      <label className="block text-sm font-bold text-on-surface" htmlFor="shop-picker">
        {label}
        {!required && <span className="ml-1 font-medium text-on-surface-variant">(선택)</span>}
      </label>
      <input
        id="shop-picker"
        className="mt-1 h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant md:h-9"
        placeholder="가게 이름을 입력하세요"
        autoComplete="off"
        value={value ? value.name : query}
        onChange={e => typed(e.target.value)}
      />

      {value ? (
        <p className="mt-1 text-xs text-on-surface-variant">
          선택됨 · {value.name}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => { onChange(null); setQuery(""); }}
          >
            다시 고르기
          </button>
        </p>
      ) : failed ? (
        <p role="alert" className="mt-1 text-xs text-error">
          가게 목록을 불러오지 못했어요. 가게 이름을 내용에 적어주셔도 됩니다.
        </p>
      ) : loading ? (
        <p className="mt-1 text-xs text-on-surface-variant">가게 목록을 불러오는 중…</p>
      ) : q.length > 0 && matches.length === 0 && all !== null ? (
        <p className="mt-1 text-xs text-on-surface-variant">찾는 가게가 없어요.</p>
      ) : (
        matches.length > 0 && (
          <ul className="mt-1 overflow-hidden rounded-lg border border-outline-variant">
            {matches.map(r => (
              <li key={r.kakao_place_id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-col justify-center px-3 py-1.5 text-left transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
                  onClick={() => { onChange({ placeId: r.kakao_place_id, name: r.name }); setQuery(""); }}
                >
                  <span className="truncate text-sm text-on-surface">{r.name}</span>
                  <span className="truncate text-xs text-on-surface-variant">{r.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
