"use client";

import { useState } from "react";
import ShopPicker from "@/components/ShopPicker";
import { CONTACT_MAX, MENU_NAME_MAX, OWNER_MENU_MAX } from "@/lib/reports";

type Row = { menuName: string; price: string };

const EMPTY: Row = { menuName: "", price: "" };

export default function OwnerMenuForm() {
  const [shop, setShop] = useState<{ placeId: string; name: string } | null>(null);
  const [contact, setContact] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY }]);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const filled = rows.filter(r => r.menuName.trim().length > 0 || r.price.length > 0);

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/owner-menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: shop?.placeId ?? null,
        contact,
        menus: filled.map(r => ({ menuName: r.menuName, price: Number(r.price) })),
        website,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? "보내지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setShop(null); setContact(""); setRows([{ ...EMPTY }]);
    setDone(true);
  };

  if (done) {
    return (
      <div className="mt-6 rounded-lg bg-surface-container p-4">
        <p className="font-bold text-on-surface">등록 요청을 받았습니다.</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          확인 전까지는 지도에 <strong>미확인</strong>으로 표시되고 가격 필터에는 잡히지
          않습니다. 확인이 필요하면 적어주신 연락처로 연락드립니다.
        </p>
        <button
          type="button"
          className="mt-3 h-11 rounded-lg bg-surface-container-high px-4 text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 md:h-9"
          onClick={() => setDone(false)}
        >
          다른 가게 등록하기
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={e => { e.preventDefault(); if (!busy) submit(); }}
    >
      <ShopPicker label="가게" required value={shop} onChange={setShop} />

      <div>
        <label className="block text-sm font-bold text-on-surface" htmlFor="owner-contact">
          연락처
        </label>
        {/* 제보와 달리 필수다. 승인 전에 확인할 일이 생기는데 그때 연락할 곳이 없으면
            어드민이 할 수 있는 게 반려밖에 없다. */}
        <input
          id="owner-contact"
          className="mt-1 h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant md:h-9"
          placeholder="이메일이나 전화번호"
          value={contact}
          maxLength={CONTACT_MAX}
          onChange={e => setContact(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-on-surface">메뉴</legend>
        <div className="mt-1 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant md:h-9"
                aria-label={`${i + 1}번째 메뉴 이름`}
                placeholder="메뉴 이름"
                value={r.menuName}
                maxLength={MENU_NAME_MAX}
                onChange={e => setRow(i, { menuName: e.target.value })}
              />
              <input
                className="h-11 w-28 rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant md:h-9"
                aria-label={`${i + 1}번째 메뉴 가격`}
                placeholder="가격"
                inputMode="numeric"
                value={r.price}
                onChange={e => setRow(i, { price: e.target.value.replace(/[^\d]/g, "") })}
              />
              <button
                type="button"
                className="h-11 w-11 shrink-0 rounded-lg text-on-surface-variant transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 disabled:opacity-30 md:h-9 md:w-9"
                aria-label={`${i + 1}번째 메뉴 지우기`}
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((_, n) => n !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 h-11 w-full rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 disabled:opacity-50 md:h-9"
          disabled={rows.length >= OWNER_MENU_MAX}
          onClick={() => setRows([...rows, { ...EMPTY }])}
        >
          {rows.length >= OWNER_MENU_MAX
            ? `한 번에 ${OWNER_MENU_MAX}개까지예요`
            : "메뉴 추가"}
        </button>
      </fieldset>

      {/* 허니팟 — ReportForm 과 같다. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        value={website}
        onChange={e => setWebsite(e.target.value)}
      />

      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        className="h-11 w-full rounded-lg bg-primary text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 md:h-9"
        disabled={busy || shop === null || contact.trim().length === 0 || filled.length === 0}
      >
        {busy ? "보내는 중…" : "등록 요청하기"}
      </button>
    </form>
  );
}
