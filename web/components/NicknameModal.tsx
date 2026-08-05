"use client";

import { useState } from "react";
import { NICKNAME_MAX_LEN } from "@/lib/nickname";

type Props = {
  mode: "create" | "edit";
  initial: string;
  onSaved: (nickname: string) => void;
  onClose: () => void;
  /** 탈퇴가 끝난 뒤. 로그아웃 상태로 되돌리는 일은 부모가 한다. */
  onWithdrawn?: () => void;
};

export default function NicknameModal({
  mode, initial, onSaved, onClose, onWithdrawn,
}: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 되돌릴 수 없는 동작이라 한 번 더 묻는다. 실수로 눌러 계정이 날아가면 안 된다.
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

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

  const withdraw = async () => {
    setError("");
    setBusy(true);
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setError("탈퇴하지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    onWithdrawn?.();
  };

  if (confirmingWithdraw) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
        <div className="w-full max-w-xs rounded-xl border border-border bg-surface p-6 shadow-lg">
          <h2 className="text-lg font-bold text-text-primary">정말 탈퇴하시겠어요?</h2>
          <p className="mt-2 text-sm text-text-muted">
            계정과 함께 <strong className="text-text-primary">작성한 리뷰</strong>와{" "}
            <strong className="text-text-primary">저장한 가게</strong>가 모두 지워집니다.
            되돌릴 수 없어요.
          </p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button
              className="grid h-11 place-items-center rounded-lg bg-red-600 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
              onClick={withdraw}
            >
              {busy ? "탈퇴 처리 중…" : "탈퇴할게요"}
            </button>
            <button
              className="grid h-11 place-items-center rounded-lg bg-surface-muted text-sm font-bold text-text-primary"
              onClick={() => { setConfirmingWithdraw(false); setError(""); }}
            >
              그만둘래요
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        {/* 탈퇴는 계정 설정에 속한다. 처음 이름을 정하는 화면에는 둘 이유가 없다. */}
        {mode === "edit" && onWithdrawn && (
          <div className="mt-4 border-t border-border-subtle pt-3 text-center">
            <button
              className="h-9 px-2 text-xs text-text-muted underline"
              onClick={() => setConfirmingWithdraw(true)}
            >
              회원 탈퇴
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
