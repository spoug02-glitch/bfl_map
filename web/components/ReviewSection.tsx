"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/app/page";

type Review = { nickname: string; taste: number; waiting: number; body: string; updated_at: string };
type Summary = { count: number; avgTaste: number | null; avgWaiting: number | null };

const MAX_LEN = 100;

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="w-20">{label}</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          aria-label={`${label} ${n}점`}
          className="grid h-11 w-11 place-items-center text-lg"
          onClick={() => onChange(n)}
        >
          <span className={n <= value ? "text-yellow-500" : "text-gray-300"}>★</span>
        </button>
      ))}
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
    <section className="mt-4 border-t pt-3">
      <h3 className="font-semibold">
        리뷰 {summary?.count ? `(${summary.count})` : ""}
      </h3>
      {summary && summary.count > 0 && (
        <p className="text-sm text-gray-600">
          맛 ★{summary.avgTaste} · 점심 웨이팅 ★{summary.avgWaiting}
        </p>
      )}

      {user ? (
        <div className="mt-2 space-y-2 rounded border p-2">
          <Stars label="맛" value={taste} onChange={setTaste} />
          <Stars label="점심 웨이팅" value={waiting} onChange={setWaiting} />
          <textarea
            className="w-full rounded border p-2 text-sm"
            rows={2}
            maxLength={MAX_LEN}
            placeholder="100자 이내로 짧게 (사진은 안 받아요, 피곤하니까)"
            value={body}
            onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
          />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{[...body].length}/{MAX_LEN}</span>
            <button
              className="h-11 rounded bg-black px-3 text-white disabled:opacity-50"
              disabled={busy}
              onClick={submit}
            >
              {busy ? "저장 중…" : "리뷰 남기기"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <a className="mt-2 grid h-11 place-items-center rounded bg-blue-600 px-3 text-center text-sm text-white" href="/api/auth/google">
          구글 로그인하고 리뷰 남기기
        </a>
      )}

      <ul className="mt-3 space-y-2">
        {reviews.map((rv, i) => (
          <li key={i} className="rounded border p-2 text-sm">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{rv.nickname}</span>
              <span>맛 ★{rv.taste} · 웨이팅 ★{rv.waiting}</span>
            </div>
            {rv.body && <p className="mt-1">{rv.body}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
