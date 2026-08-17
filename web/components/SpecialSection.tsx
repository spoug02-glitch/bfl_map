"use client";

import { useEffect, useState } from "react";
import { SPECIAL_DISCLAIMER, formatPrice } from "@/lib/constants";
import { SPECIAL_NAME_MAX, SPECIAL_NOTE_MAX } from "@/lib/specials";

type Special = {
  menu_name: string;
  price: number;
  taste: number | null;
  note: string | null;
  created_at: string;
};

/** 맛별점 입력. 선택이라 같은 별을 다시 누르면 지워진다 — 리뷰의 Stars와 달리 0이 있다. */
function OptionalStars({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-on-surface-variant">맛</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          aria-label={`맛 ${n}점${value === n ? " 지우기" : ""}`}
          className="grid h-9 w-8 place-items-center text-lg"
          onClick={() => onChange(value === n ? null : n)}
        >
          <span className={value !== null && n <= value ? "text-star" : "text-outline"}>★</span>
        </button>
      ))}
      <span className="text-xs text-on-surface-variant">(선택)</span>
    </div>
  );
}

/**
 * 점심 특선 제보. 카카오 메뉴 5개에는 특선이 거의 안 올라와서, 실제로 먹은
 * 사람이 메뉴명·가격(필수)과 맛별점·비고(선택)를 남긴다. 한 가게에 한 사람이
 * 하나 — 다시 제보하면 이전 것을 덮는다.
 */
export default function SpecialSection({ placeId, loggedIn }: { placeId: string; loggedIn: boolean }) {
  const [specials, setSpecials] = useState<Special[]>([]);
  const [open, setOpen] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [price, setPrice] = useState("");
  const [taste, setTaste] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/specials?placeId=${placeId}`)
      .then(r => r.json())
      .then(d => setSpecials(d.specials ?? []))
      .catch(() => {});
  }, [placeId]);

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/specials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId,
        menuName,
        price: Number(price),
        taste,
        note: note || null,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? "제보하지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setOpen(false);
    setMenuName(""); setPrice(""); setTaste(null); setNote("");
    fetch(`/api/specials?placeId=${placeId}`)
      .then(r => r.json())
      .then(d => setSpecials(d.specials ?? []))
      .catch(() => {});
  };

  return (
    <section className="mt-6">
      <h3 className="border-b border-outline-variant pb-2 text-xl font-bold text-on-surface">
        점심 특선 <span className="text-sm font-medium text-on-surface-variant">제보받아요</span>
      </h3>
      <p className="mt-1.5 text-xs text-on-surface-variant">{SPECIAL_DISCLAIMER}</p>

      {specials.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">
          아직 제보가 없어요. 이 집 점심특선을 아신다면 알려주세요.
        </p>
      ) : (
        <ul className="mt-1">
          {specials.map((s, i) => (
            <li key={i} className="border-b border-outline-variant/50 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-2 text-base">
                <span className="min-w-0 flex-1 truncate text-on-surface">{s.menu_name}</span>
                {/* ★ 만 별색이다 — 이유는 ReviewSection 의 요약 배지 주석 참고 */}
                {s.taste !== null && (
                  <span className="shrink-0 text-sm text-on-surface"><span className="text-star">★</span>{s.taste}</span>
                )}
                <span className="shrink-0 text-price">{formatPrice(String(s.price))}</span>
              </div>
              {s.note && <p className="mt-1 text-sm text-on-surface-variant">{s.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {!loggedIn ? (
        <p className="mt-3 text-xs text-on-surface-variant">로그인하면 제보할 수 있어요.</p>
      ) : !open ? (
        <button
          className="mt-3 h-11 w-full rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
          onClick={() => setOpen(true)}
        >
          점심 특선 제보하기
        </button>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={e => { e.preventDefault(); if (!busy) submit(); }}
        >
          <input
            className="h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant"
            placeholder="메뉴명 (예: 초밥 8pc+냉모밀)"
            value={menuName}
            maxLength={SPECIAL_NAME_MAX}
            onChange={e => setMenuName(e.target.value)}
          />
          <input
            className="h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant"
            placeholder="가격 (원)"
            inputMode="numeric"
            value={price}
            onChange={e => setPrice(e.target.value.replace(/[^\d]/g, ""))}
          />
          <OptionalStars value={taste} onChange={setTaste} />
          <input
            className="h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant"
            placeholder="비고 (선택 — 예: 평일 11:30~13:30만)"
            value={note}
            maxLength={SPECIAL_NOTE_MAX}
            onChange={e => setNote(e.target.value)}
          />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="h-11 flex-1 rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10"
              onClick={() => { setOpen(false); setError(""); }}
            >
              취소
            </button>
            <button
              type="submit"
              className="h-11 flex-1 rounded-lg bg-primary transition-colors hover:bg-primary/90 active:bg-primary/80 text-sm font-bold text-on-primary disabled:opacity-50"
              disabled={busy || menuName.trim().length === 0 || price.length === 0}
            >
              {busy ? "보내는 중…" : "제보하기"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
