"use client";

import IntakeQueue from "@/components/admin/IntakeQueue";

import { useCallback, useEffect, useState } from "react";
import { isSuspensionActive } from "@/lib/suspension";

type UserRow = { user_id: string; nickname: string; created_at: string; suspended_until: string | null };
type SuspensionRecord = {
  id: number; reason: string; duration_label: string; suspended_until: string;
  created_at: string; lifted_at: string | null; adminUsername: string;
};
type UserDetail = {
  user: { user_id: string; nickname: string; created_at: string; suspended_until: string | null; reviewCount: number };
  recentReviews: { id: number; place_id: string; taste: number; convenience: number; body: string; created_at: string }[];
  history: SuspensionRecord[];
};
type Stats = {
  dau: number;
  wau: number;
  mau: number;
  /** 최근 7일 안에 2일 이상 방문한 사람 — 이번 주에 얼마나 자주 왔는지. */
  weeklyRepeat: number;
  /** 최근 7일에 왔고 그 이전에도 온 적이 있는 사람 — 신규가 아닌 사람. */
  weeklyReturning: number;
};
type CrawlRun = {
  startedAt: string;
  finishedAt: string;
  districts: string[];
  codes: string[];
  crawled: number;
  matched: number;
  unresolved: number;
  outOfRadius: number;
  duplicates: number;
};

const DURATIONS = [
  { label: "1시간", value: "1h" },
  { label: "3시간", value: "3h" },
  { label: "1일", value: "1d" },
  { label: "3일", value: "3d" },
  { label: "7일", value: "7d" },
  { label: "영구", value: "permanent" },
];

function isActive(until: string | null): boolean {
  return isSuspensionActive(until ? new Date(until) : null);
}

function UserDetailPanel({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState("1d");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/users/${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const suspend = async () => {
    setError("");
    if (reason.trim() === "") { setError("정지 사유를 입력해주세요."); return; }
    setBusy(true);
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration, reason }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = (await res?.json().catch(() => ({}))) ?? {};
      setError(d.error ?? "정지 처리에 실패했어요.");
      return;
    }
    setReason("");
    load();
    onChanged();
  };

  const unsuspend = async () => {
    setError("");
    setBusy(true);
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/unsuspend`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { setError("해제에 실패했어요."); return; }
    load();
    onChanged();
  };

  if (loading) return <p className="p-4 text-sm text-on-surface-variant">불러오는 중…</p>;
  if (!detail) return <p className="p-4 text-sm text-red-600">불러오지 못했어요.</p>;

  const suspended = isActive(detail.user.suspended_until);

  return (
    <div className="space-y-4 rounded-lg border border-outline bg-surface-container-lowest p-4">
      <div>
        <h3 className="font-bold text-on-surface">{detail.user.nickname}</h3>
        <p className="text-xs text-on-surface-variant">
          {detail.user.user_id} · 가입 {detail.user.created_at.slice(0, 10)} · 리뷰 {detail.user.reviewCount}개
        </p>
        <p className="mt-1 text-sm font-medium">
          {suspended ? (
            <span className="text-red-600">
              정지 중{detail.user.suspended_until && ` (${detail.user.suspended_until.slice(0, 16).replace("T", " ")}까지)`}
            </span>
          ) : (
            <span className="text-green-700">정상</span>
          )}
        </p>
      </div>

      {suspended ? (
        <button
          className="h-11 rounded-lg bg-surface-container px-4 text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 disabled:opacity-50"
          disabled={busy}
          onClick={unsuspend}
        >
          {busy ? "처리 중…" : "정지 해제"}
        </button>
      ) : (
        <div className="space-y-2">
          <select
            className="h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface"
            value={duration}
            onChange={e => setDuration(e.target.value)}
          >
            {DURATIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <textarea
            className="w-full rounded-lg bg-surface-container p-3 text-sm text-on-surface"
            rows={2}
            placeholder="정지 사유 (내부 기록용)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <button
            className="h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={suspend}
          >
            {busy ? "처리 중…" : "정지"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      <div>
        <h4 className="text-sm font-bold text-on-surface">최근 리뷰</h4>
        {detail.recentReviews.length === 0 ? (
          <p className="text-xs text-on-surface-variant">없음</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs text-on-surface-variant">
            {detail.recentReviews.map(r => (
              <li key={r.id}>{r.created_at.slice(0, 10)} · {r.place_id} · ★{r.taste}/{r.convenience} · {r.body}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-on-surface">정지 이력</h4>
        {detail.history.length === 0 ? (
          <p className="text-xs text-on-surface-variant">없음</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs text-on-surface-variant">
            {detail.history.map(h => (
              <li key={h.id}>
                {h.created_at.slice(0, 10)} · {h.duration_label} · {h.reason} · by {h.adminUsername}
                {h.lifted_at && ` · 해제됨(${h.lifted_at.slice(0, 10)})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard({ role }: { role: "super_admin" | "operator" }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [crawlRuns, setCrawlRuns] = useState<CrawlRun[]>([]);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(setStats);
  }, []);

  useEffect(() => {
    fetch("/api/admin/crawl-runs").then(r => r.json()).then(d => setCrawlRuns(d.runs ?? []));
  }, []);

  const search = useCallback(() => {
    setSearching(true);
    fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .finally(() => setSearching(false));
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    search();
  }, [search]);

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/admin/login";
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-on-surface">어드민</h1>
        <div className="flex items-center gap-3">
          {role === "super_admin" && (
            <a href="/admin/operators" className="text-sm text-primary underline">운영자 관리</a>
          )}
          <button className="text-sm text-on-surface-variant underline" onClick={logout}>로그아웃</button>
        </div>
      </div>

      {/* 접수함이 통계보다 위에 있다. 통계는 봐도 그만이지만 접수함은 방치되면
          스펙이 걱정한 그대로 — 열어놓고 아무도 안 보는 창구가 된다. */}
      <IntakeQueue />

      {/* 트래픽 양과 재방문 질은 성격이 달라 줄을 나눈다 — 다섯 개를 한 줄에
          몰면 좁은 화면에서 어느 숫자가 무엇인지 읽히지 않는다. */}
      {stats && (
        <div className="mt-4 space-y-1">
          <p className="rounded-xl bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface">
            DAU {stats.dau} · WAU {stats.wau} · MAU {stats.mau}
          </p>
          <p className="rounded-xl bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface">
            이번 주 2일 이상 {stats.weeklyRepeat} · 이전에도 방문 {stats.weeklyReturning}
          </p>
        </div>
      )}

      {crawlRuns.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-on-surface">크롤링 이력</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-outline">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container text-on-surface-variant">
                <tr>
                  <th className="px-3 py-2 font-medium">실행 시각</th>
                  <th className="px-3 py-2 font-medium">지역</th>
                  <th className="px-3 py-2 font-medium">수집/매칭/미해결/반경밖/중복</th>
                </tr>
              </thead>
              <tbody>
                {crawlRuns.slice(0, 20).map(run => (
                  <tr key={run.startedAt} className="border-t border-outline-variant">
                    <td className="px-3 py-2 text-on-surface">
                      {run.startedAt.slice(0, 16).replace("T", " ")} ~ {run.finishedAt.slice(11, 16)}
                    </td>
                    <td className="px-3 py-2 text-on-surface-variant">{run.districts.join(", ")}</td>
                    <td className="px-3 py-2 text-on-surface-variant">
                      {run.crawled}/{run.matched}/{run.unresolved}/{run.outOfRadius}/{run.duplicates}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <input
          className="h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface"
          placeholder="닉네임 또는 유저 ID 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {searching && <p className="mt-2 text-xs text-on-surface-variant">검색 중…</p>}
        <ul className="mt-2 space-y-1">
          {users.map(u => (
            <li key={u.user_id}>
              <button
                className={`h-11 w-full rounded-lg px-3 text-left text-sm ${
                  selected === u.user_id ? "bg-primary transition-colors hover:bg-primary/90 active:bg-primary/80 text-on-primary" : "bg-surface-container text-on-surface"
                }`}
                onClick={() => setSelected(u.user_id)}
              >
                {u.nickname} {isActive(u.suspended_until) && "(정지 중)"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="mt-6">
          <UserDetailPanel key={selected} userId={selected} onChanged={search} />
        </div>
      )}
    </div>
  );
}
