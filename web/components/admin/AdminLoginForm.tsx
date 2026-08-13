"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).catch(() => null);
    setBusy(false);
    if (!res) { setError("네트워크 오류가 발생했어요. 다시 시도해주세요."); return; }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "로그인에 실패했어요.");
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="mx-auto mt-24 max-w-xs px-6">
      <h1 className="text-lg font-bold text-text-primary">운영자 로그인</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          placeholder="아이디"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          className="h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          className="h-11 w-full rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
          disabled={busy || !username || !password}
        >
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
