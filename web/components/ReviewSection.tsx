"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/constants";
import { kstDateTime } from "@/lib/kst";
import { CONTACT_LINE, suspensionNotice } from "@/lib/legal";
import { isPermanentSuspension, isSuspensionActive } from "@/lib/suspension";

type Review = {
  id: number;
  nickname: string;
  taste: number;
  convenience: number;
  body: string;
  created_at: string;
  /** 서버가 세션과 대조해 판정한다 — user_id를 내려보내지 않기 위해서다. */
  mine: boolean;
};
type Summary = { count: number; avgTaste: number | null; avgConvenience: number | null };

const MAX_LEN = 100;

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between text-base">
      <span className="whitespace-nowrap text-on-surface">{label}</span>
      {/* 별 사이 간격을 두지 않는다. 44px 버튼 5개(220px)만으로도 375px 화면에서
          "점심 편의성"이 한 줄에 들어가는데, gap-1(16px)을 더하면 1px이 모자라
          라벨이 두 줄로 접혔다. 탭 타깃은 44x44 그대로 유지한다. */}
      <div className="flex shrink-0 items-center">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            aria-label={`${label} ${n}점`}
            // 360px 미만(구형 SE 등)에서는 별 5개 220px + 라벨 74px이 패널을 넘겨
            // 가로 스크롤을 만든다. 그 구간에서만 폭을 좁히고 높이 44px는 지킨다.
            className="grid h-11 w-9 place-items-center text-xl min-[360px]:w-11"
            onClick={() => onChange(n)}
          >
            <span className={n <= value ? "text-star" : "text-outline-variant"}>★</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 이미 쓴 리뷰를 그 자리에서 고친다. 작성 폼과 별개로 두어 서로 상태가 섞이지 않는다. */
function ReviewEditor({
  review, onCancel, onSaved,
}: { review: Review; onCancel: () => void; onSaved: () => void }) {
  const [taste, setTaste] = useState(review.taste);
  const [convenience, setConvenience] = useState(review.convenience);
  const [body, setBody] = useState(review.body);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taste, convenience, body }),
    }).catch(() => null);
    setBusy(false);
    if (!res) { setError("네트워크 오류가 발생했어요. 다시 시도해주세요."); return; }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "저장에 실패했어요.");
      return;
    }
    onSaved();
  };

  return (
    <div className="mt-3 space-y-3">
      <Stars label="맛" value={taste} onChange={setTaste} />
      <Stars label="점심 편의성" value={convenience} onChange={setConvenience} />
      <textarea
        className="w-full rounded-lg bg-surface-container p-3 text-base text-on-surface"
        rows={2}
        maxLength={MAX_LEN}
        aria-label="리뷰 내용"
        value={body}
        onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          className="h-11 rounded-lg bg-surface-container px-4 text-sm font-bold text-on-surface"
          onClick={onCancel}
        >
          취소
        </button>
        <button
          className="h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-50"
          disabled={busy}
          onClick={save}
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

export default function ReviewSection({ placeId, user }: { placeId: string; user: SessionUser | null }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [taste, setTaste] = useState(0);
  const [convenience, setConvenience] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [listError, setListError] = useState("");

  const suspendedUntilDate = user?.suspendedUntil ? new Date(user.suspendedUntil) : null;
  const suspended = isSuspensionActive(suspendedUntilDate);
  const suspendedNotice = suspendedUntilDate
    ? suspensionNotice(isPermanentSuspension(suspendedUntilDate) ? null : kstDateTime(suspendedUntilDate))
    : "";

  const load = useCallback(() => {
    fetch(`/api/reviews?placeId=${placeId}`)
      .then(r => r.json())
      .then(d => { setReviews(d.reviews ?? []); setSummary(d.summary ?? null); });
  }, [placeId]);

  useEffect(load, [load]);

  const submit = async () => {
    setError("");
    if (taste === 0 || convenience === 0) { setError("맛과 점심 편의성 별점을 모두 선택해주세요."); return; }
    setBusy(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, taste, convenience, body }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "저장에 실패했습니다.");
      return;
    }
    setBody(""); setTaste(0); setConvenience(0);
    load();
  };

  const remove = async (id: number) => {
    setListError("");
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res) { setListError("네트워크 오류가 발생했어요. 다시 시도해주세요."); return; }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setListError(d.error ?? "삭제에 실패했어요.");
      return;
    }
    load();
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-on-surface">
          리뷰 {summary?.count ? `(${summary.count})` : ""}
        </h3>
        {/* 별은 어디서나 text-star다. 요약만 다른 색을 쓰면 같은 지표가 위아래에서
            달라 보인다 — 아래 리뷰 카드와 정확히 같은 표기를 쓴다. */}
        {summary && summary.count > 0 && (
          <p className="rounded-xl bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface">
            맛 <span className="text-star">★{summary.avgTaste}</span> ·{" "}
            점심 편의성 <span className="text-star">★{summary.avgConvenience}</span>
          </p>
        )}
      </div>

      {user ? (
        <div className="mt-4 space-y-4 rounded-lg border border-outline bg-surface-container-lowest p-4 shadow-xs">
          <h4 className="font-bold text-on-surface">내 리뷰 작성</h4>
          {suspended && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {suspendedNotice}
              <br />
              {CONTACT_LINE}
            </p>
          )}
          <fieldset disabled={suspended} className="space-y-4">
            <Stars label="맛" value={taste} onChange={setTaste} />
            <Stars label="점심 편의성" value={convenience} onChange={setConvenience} />
            <textarea
              className="w-full rounded-lg bg-surface-container p-3 text-base text-on-surface placeholder:text-on-surface-variant disabled:opacity-50"
              rows={2}
              maxLength={MAX_LEN}
              placeholder="100자 이내로 짧게(사진은 나중에, 우리는 직장인이라 바쁘니까)"
              value={body}
              onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface-variant">{[...body].length}/{MAX_LEN}</span>
              <button
                className="h-11 rounded-lg bg-primary px-6 text-sm font-bold text-on-primary disabled:opacity-50"
                disabled={busy || suspended}
                onClick={submit}
              >
                {busy ? "저장 중…" : "리뷰 남기기"}
              </button>
            </div>
          </fieldset>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-4 rounded-lg border border-outline p-4 text-center shadow-xs">
          <p className="text-base text-on-surface-variant">리뷰를 남기려면 로그인이 필요합니다.</p>
          <a
            className="grid h-11 place-items-center rounded-lg bg-primary text-center text-base font-bold text-on-primary"
            href="/api/auth/kakao"
          >
            카카오로 로그인하고 리뷰 남기기
          </a>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {reviews.map(rv => (
          <li key={rv.id} className="rounded-lg border border-outline p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-on-surface">{rv.nickname}</span>
              <span className="text-xs font-medium text-on-surface-variant">
                맛 <span className="text-star">★{rv.taste}</span> · 편의성 <span className="text-star">★{rv.convenience}</span>
              </span>
            </div>
            {editing === rv.id ? (
              <ReviewEditor
                review={rv}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); load(); }}
              />
            ) : (
              <>
                {rv.body && <p className="mt-2 text-base text-on-surface">{rv.body}</p>}
                {rv.mine && (
                  <div className="mt-2 flex justify-end gap-1">
                    {!suspended && (
                      <button
                        className="h-11 rounded-lg px-3 text-sm font-medium text-on-surface-variant"
                        onClick={() => setEditing(rv.id)}
                      >
                        수정
                      </button>
                    )}
                    <button
                      className="h-11 rounded-lg px-3 text-sm font-medium text-on-surface-variant"
                      onClick={() => remove(rv.id)}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {listError && <p className="mt-2 text-xs text-red-600">{listError}</p>}
    </section>
  );
}
