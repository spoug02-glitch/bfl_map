"use client";

import { useState } from "react";
import { NICKNAME_MAX_LEN } from "@/lib/nickname";

type Props = {
  mode: "create" | "edit";
  initial: string;
  onSaved: (nickname: string) => void;
  onClose: () => void;
};

export default function NicknameModal({ mode, initial, onSaved, onClose }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError("");
    setBusy(true);
    // 모달을 닫을 수 없는 화면이라, 실패를 삼키면 사용자가 갇힌다.
    const res = await fetch("/api/auth/nickname", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: value }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError("네트워크 오류가 발생했어요. 다시 시도해주세요.");
      return;
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "저장에 실패했어요.");
      return;
    }
    const d = await res.json().catch(() => null);
    if (!d?.nickname) {
      setError("저장에 실패했어요.");
      return;
    }
    onSaved(d.nickname);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-xl border border-border bg-surface p-6 shadow-lg">
        <h2 className="text-lg font-bold text-text-primary">
          {mode === "create" ? "쓸 이름을 정해주세요" : "닉네임 변경"}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          리뷰에 이 이름으로 표시돼요. 카카오·구글 이름은 쓰지 않아요.
        </p>
        <input
          className="mt-4 h-11 w-full rounded-lg bg-surface-muted px-3 text-base text-text-primary"
          value={value}
          maxLength={NICKNAME_MAX_LEN}
          onChange={e => setValue(e.target.value)}
          aria-label="닉네임"
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button
            className="grid h-11 place-items-center rounded-lg bg-ink text-sm font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={save}
          >
            {busy ? "저장 중…" : "확인"}
          </button>
          {mode === "edit" && (
            <button
              className="grid h-11 place-items-center rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
              onClick={onClose}
            >
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
