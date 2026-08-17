"use client";

import { useCallback, useEffect, useState } from "react";

type Operator = { id: number; username: string; role: "super_admin" | "operator"; is_active: boolean; created_at: string };

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"super_admin" | "operator">("operator");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/operators").then(r => r.json()).then(d => setOperators(d.operators ?? []));
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/operators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = (await res?.json().catch(() => ({}))) ?? {};
      setError(d.error ?? "생성에 실패했어요.");
      return;
    }
    setUsername("");
    setPassword("");
    load();
  };

  const deactivate = async (id: number) => {
    setError("");
    const res = await fetch(`/api/admin/operators/${id}/deactivate`, { method: "POST" }).catch(() => null);
    if (!res || !res.ok) {
      const d = (await res?.json().catch(() => ({}))) ?? {};
      setError(d.error ?? "비활성화에 실패했어요.");
      return;
    }
    load();
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <a href="/admin" className="text-sm text-primary underline">← 대시보드</a>
      <h1 className="mt-2 text-lg font-bold text-on-surface">운영자 관리</h1>

      <div className="mt-6 space-y-2 rounded-lg border border-outline p-4">
        <input
          className="h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface"
          placeholder="아이디 (3자 이상)"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          type="password"
          className="h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface"
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <select
          className="h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface"
          value={role}
          onChange={e => setRole(e.target.value as "super_admin" | "operator")}
        >
          <option value="operator">운영자</option>
          <option value="super_admin">최고관리자</option>
        </select>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button
          className="h-11 rounded-lg bg-primary transition-colors hover:bg-primary/90 active:bg-primary/80 px-4 text-sm font-bold text-on-primary disabled:opacity-50"
          disabled={busy || username.trim().length < 3 || password.length < 8}
          onClick={create}
        >
          {busy ? "생성 중…" : "계정 생성"}
        </button>
      </div>

      <ul className="mt-6 space-y-2">
        {operators.map(op => (
          <li key={op.id} className="flex items-center justify-between rounded-lg border border-outline p-3">
            <div>
              <p className="text-sm font-bold text-on-surface">{op.username}</p>
              <p className="text-xs text-on-surface-variant">
                {op.role === "super_admin" ? "최고관리자" : "운영자"} · {op.is_active ? "활성" : "비활성"}
              </p>
            </div>
            {op.is_active && (
              <button className="text-xs text-red-600 underline" onClick={() => deactivate(op.id)}>
                비활성화
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
