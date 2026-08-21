"use client";

import { useState } from "react";
import ShopPicker from "@/components/ShopPicker";
import {
  BODY_MAX, CONTACT_MAX, REPORT_KINDS, REPORT_KIND_LABELS, type ReportKind,
} from "@/lib/reports";

export default function ReportForm() {
  const [kind, setKind] = useState<ReportKind>("place_fix");
  const [shop, setShop] = useState<{ placeId: string; name: string } | null>(null);
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        placeId: shop?.placeId ?? null,
        body,
        contact: contact || null,
        website,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? "보내지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setKind("place_fix"); setShop(null); setBody(""); setContact("");
    setDone(true);
  };

  if (done) {
    return (
      <div className="mt-6 rounded-lg bg-surface-container p-4">
        <p className="font-bold text-on-surface">보내주셔서 고맙습니다.</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          확인하고 필요하면 적어주신 연락처로 답을 드립니다. 개인이 운영하는 서비스라 며칠
          걸릴 수 있습니다.
        </p>
        <button
          type="button"
          className="mt-3 h-11 rounded-lg bg-surface-container-high px-4 text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 md:h-9"
          onClick={() => setDone(false)}
        >
          하나 더 보내기
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={e => { e.preventDefault(); if (!busy) submit(); }}
    >
      <fieldset>
        <legend className="text-sm font-bold text-on-surface">어떤 내용인가요?</legend>
        <div className="mt-1 space-y-1">
          {REPORT_KINDS.map(k => (
            <label key={k} className="flex min-h-11 items-center gap-2 text-on-surface">
              <input
                type="radio"
                name="kind"
                className="h-4 w-4 accent-primary"
                checked={kind === k}
                onChange={() => setKind(k)}
              />
              <span className="text-sm">{REPORT_KIND_LABELS[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 다른 종류는 가게가 선택이다. 결제 실패만은 어느 가게였는지가 제보의 전부라
          필수인 걸 라벨로 먼저 알린다 — 다 적고 나서 거절당하면 다시 안 보낸다. */}
      <ShopPicker
        label={kind === "zeropay_fail" ? "가게 (꼭 골라주세요)" : "가게"}
        value={shop}
        onChange={setShop}
      />

      <div>
        <label className="block text-sm font-bold text-on-surface" htmlFor="report-body">
          내용
        </label>
        <textarea
          id="report-body"
          className="mt-1 w-full rounded-lg bg-surface-container px-3 py-2 text-base text-on-surface placeholder:text-on-surface-variant"
          rows={6}
          placeholder="무엇이 어떻게 다른지 적어주세요."
          value={body}
          maxLength={BODY_MAX}
          onChange={e => setBody(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-on-surface" htmlFor="report-contact">
          연락처 <span className="ml-1 font-medium text-on-surface-variant">(선택)</span>
        </label>
        <input
          id="report-contact"
          className="mt-1 h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface placeholder:text-on-surface-variant md:h-9"
          placeholder="이메일이나 전화번호 — 답이 필요할 때만"
          value={contact}
          maxLength={CONTACT_MAX}
          onChange={e => setContact(e.target.value)}
        />
      </div>

      {/* 허니팟. 사람 눈에는 없는 칸이라 값이 차 있으면 봇이다. 자동완성이 대신
          채워버리지 않도록 autoComplete 을 끈다. */}
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
        disabled={busy || body.trim().length === 0}
      >
        {busy ? "보내는 중…" : "보내기"}
      </button>
    </form>
  );
}
