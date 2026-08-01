"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/app/page";

type Review = { nickname: string; taste: number; waiting: number; body: string; updated_at: string };
type Summary = { count: number; avgTaste: number | null; avgWaiting: number | null };

const MAX_LEN = 100;

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between text-base">
      <span className="text-text-primary">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n}점`}
            className="grid h-11 w-11 place-items-center text-xl"
            onClick={() => onChange(n)}
          >
            <span className={n <= value ? "text-star" : "text-border"}>★</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReviewSection({ placeId, user }: { placeId: string; user: SessionUser | null }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [taste, setTaste] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/reviews?placeId=${placeId}`)
      .then(r => r.json())
      .then(d => { setReviews(d.reviews ?? []); setSummary(d.summary ?? null); });
  }, [placeId]);

  useEffect(load, [load]);

  const submit = async () => {
    setError("");
    if (taste === 0 || waiting === 0) { setError("맛과 점심 웨이팅 별점을 모두 선택해주세요."); return; }
    setBusy(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, taste, waiting, body }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "저장에 실패했습니다.");
      return;
    }
    setBody(""); setTaste(0); setWaiting(0);
    load();
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-text-primary">
          리뷰 {summary?.count ? `(${summary.count})` : ""}
        </h3>
        {summary && summary.count > 0 && (
          <p className="rounded-xl bg-surface-muted px-3 py-1.5 text-xs font-medium text-text-primary">
            맛 ★{summary.avgTaste} · <span className="text-price">점심 웨이팅 ★{summary.avgWaiting}</span>
          </p>
        )}
      </div>

      {user ? (
        <div className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <h4 className="font-bold text-text-primary">내 리뷰 작성</h4>
          <Stars label="맛" value={taste} onChange={setTaste} />
          <Stars label="점심 웨이팅" value={waiting} onChange={setWaiting} />
          <textarea
            className="w-full rounded-lg bg-surface-muted p-3 text-base text-text-primary placeholder:text-text-muted"
            rows={2}
            maxLength={MAX_LEN}
            placeholder="100자 이내로 짧게 (사진은 안 받아요, 피곤하니까)"
            value={body}
            onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{[...body].length}/{MAX_LEN}</span>
            <button
              className="h-11 rounded-lg bg-ink px-6 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={submit}
            >
              {busy ? "저장 중…" : "리뷰 남기기"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-4 rounded-lg border border-border p-4 text-center shadow-xs">
          <p className="text-base text-text-muted">리뷰를 남기려면 로그인이 필요합니다.</p>
          <a
            className="grid h-11 place-items-center rounded-lg bg-brand-kakao text-center text-base font-bold text-brand-kakao-text"
            href="/api/auth/kakao"
          >
            카카오로 로그인하고 리뷰 남기기
          </a>
          <a
            className="grid h-11 place-items-center rounded-lg border border-border text-center text-sm font-bold text-text-primary"
            href="/api/auth/google"
          >
            구글로 로그인
          </a>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {reviews.map((rv, i) => (
          <li key={i} className="rounded-lg border border-border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-primary">{rv.nickname}</span>
              <span className="text-xs font-medium text-text-muted">
                맛 <span className="text-star">★{rv.taste}</span> · 웨이팅 <span className="text-star">★{rv.waiting}</span>
              </span>
            </div>
            {rv.body && <p className="mt-2 text-base text-text-primary">{rv.body}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
