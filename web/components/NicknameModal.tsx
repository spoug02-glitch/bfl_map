"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NICKNAME_MAX_LEN, WITHDRAWN_NICKNAME } from "@/lib/nickname";
import { REJOIN_BLOCK_DAYS } from "@/lib/rejoin";
import { kstDateTime } from "@/lib/kst";
import { CONTACT_LINE, suspensionNotice } from "@/lib/legal";
import { isPermanentSuspension, isSuspensionActive } from "@/lib/suspension";

type Props = {
  mode: "create" | "edit";
  initial: string;
  onSaved: (nickname: string) => void;
  onClose: () => void;
  /** 탈퇴가 끝난 뒤. 로그아웃 상태로 되돌리는 일은 부모가 한다. */
  onWithdrawn?: () => void;
  /**
   * 닉네임을 못 정하고 빠져나가는 유일한 출구. create 모드에서만 쓴다.
   *
   * 헤더에도 같은 버튼이 있지만 aria-modal이 그걸 보조기기에서 가리고 초점 가둠이
   * 키보드에서도 막는다. 저장이 계속 실패할 때 갇히지 않으려면 출구가 이 안에
   * 있어야 한다.
   */
  onLogout?: () => void;
  /** edit 모드에서만 쓴다. 정지 중이면 배너를 보여주고 입력을 잠근다. */
  suspendedUntil?: string | null;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
  ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 초점을 안에 가두고 바깥을 보조기기에서 숨기는 대화상자.
 *
 * aria-modal만 붙이고 초점을 그대로 두면 Tab이 뒤 화면으로 새어 나가, 스크린리더가
 * "바깥은 없다"고 말한 것과 실제 초점이 어긋난다. 둘은 같이 가야 한다.
 */
function Dialog({
  labelledBy, onEscape, initialFocus, children,
}: {
  labelledBy: string;
  /** Esc로 닫을 수 있으면 넘긴다. 닉네임을 처음 정하는 화면은 닫을 수 없다. */
  onEscape?: () => void;
  initialFocus: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 열기 전 초점을 기억했다가 닫을 때 돌려준다 — 안 그러면 닫은 뒤 초점이
    // 문서 맨 앞으로 떨어져 하던 자리를 잃는다.
    const opener = document.activeElement as HTMLElement | null;
    initialFocus.current?.focus();
    return () => opener?.focus?.();
  }, [initialFocus]);

  // 대화상자가 아니라 document에서 듣는다. 어두운 배경을 클릭하면 초점이 body로
  // 빠지는데, 상자에만 걸어두면 그 순간부터 Esc도 Tab 가둠도 죽는다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = box.current;
      if (!el) return;
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      // 초점이 밖으로 나가 있으면 되돌린다. 경계에 있으면 반대편으로 감는다.
      if (!el.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (document.activeElement !== (e.shiftKey ? first : last)) return;
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-xs rounded-xl border border-outline bg-surface-container-lowest p-6 shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}

export default function NicknameModal({
  mode, initial, suspendedUntil = null, onSaved, onClose, onWithdrawn, onLogout,
}: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 되돌릴 수 없는 동작이라 한 번 더 묻는다. 실수로 눌러 계정이 날아가면 안 된다.
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);

  const suspendedUntilDate = suspendedUntil ? new Date(suspendedUntil) : null;
  const suspended = isSuspensionActive(suspendedUntilDate);
  const suspendedNotice = suspendedUntilDate
    ? suspensionNotice(isPermanentSuspension(suspendedUntilDate) ? null : kstDateTime(suspendedUntilDate))
    : "";

  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelWithdrawRef = useRef<HTMLButtonElement | null>(null);

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

  const backFromWithdraw = () => { setConfirmingWithdraw(false); setError(""); };

  if (confirmingWithdraw) {
    return (
      // 처음 열릴 때 초점은 "그만둘래요"에 둔다. 되돌릴 수 없는 쪽에 초점을 두면
      // Enter 한 번에 계정이 날아간다.
      <Dialog labelledBy={titleId} onEscape={backFromWithdraw} initialFocus={cancelWithdrawRef}>
        <h2 id={titleId} className="text-lg font-bold text-on-surface">정말 탈퇴하시겠어요?</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          계정과 <strong className="text-on-surface">저장한 가게</strong>는 지워집니다.
          남긴 <strong className="text-on-surface">리뷰와 점심특선 제보</strong>는{" "}
          <strong className="text-on-surface">{WITHDRAWN_NICKNAME}</strong>로 남습니다.
        </p>
        {/* 탈퇴하면 본인 글도 못 지운다. 누구 글인지 아무도 모르게 되기 때문인데,
            그건 지우고 나서 알면 늦는 사실이라 누르기 전에 말한다. */}
        <p className="mt-2 text-sm text-on-surface-variant">
          계정과의 연결이 끊겨 <strong className="text-on-surface">나중에 고치거나 지울 수
          없습니다.</strong> 지우고 싶은 글이 있다면 탈퇴 전에 지워주세요.
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          탈퇴 후 <strong className="text-on-surface">{REJOIN_BLOCK_DAYS}일간</strong>은 다시
          가입할 수 없습니다.
        </p>
        {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="grid h-11 place-items-center rounded-lg bg-red-600 text-sm font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={withdraw}
          >
            {busy ? "탈퇴 처리 중…" : "탈퇴할게요"}
          </button>
          <button
            ref={cancelWithdrawRef}
            type="button"
            className="grid h-11 place-items-center rounded-lg bg-surface-container text-sm font-bold text-on-surface"
            onClick={backFromWithdraw}
          >
            그만둘래요
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      labelledBy={titleId}
      onEscape={mode === "edit" ? onClose : undefined}
      initialFocus={inputRef}
    >
      <h2 id={titleId} className="text-lg font-bold text-on-surface">
        {mode === "create" ? "쓸 이름을 정해주세요" : "닉네임 변경"}
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        리뷰에 이 이름으로 표시돼요. 카카오·구글 이름은 쓰지 않아요.
      </p>
      {suspended && (
        <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {suspendedNotice}
          <br />
          {CONTACT_LINE}
        </p>
      )}
      {/* form으로 감싸야 입력칸에서 Enter가 저장으로 간다. 버튼까지 Tab으로
          내려가야만 저장되는 건 키보드로 쓰는 사람에게만 붙는 통행료다. */}
      <form onSubmit={e => { e.preventDefault(); if (!busy) save(); }}>
        <input
          ref={inputRef}
          className="mt-4 h-11 w-full rounded-lg bg-surface-container px-3 text-base text-on-surface disabled:opacity-50"
          value={value}
          maxLength={NICKNAME_MAX_LEN}
          onChange={e => setValue(e.target.value)}
          aria-label="닉네임"
          aria-invalid={error !== ""}
          disabled={suspended}
        />
        {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="submit"
            className="grid h-11 place-items-center rounded-lg bg-primary transition-colors hover:bg-primary/90 active:bg-primary/80 text-sm font-bold text-on-primary disabled:opacity-50"
            disabled={busy || suspended}
          >
            {busy ? "저장 중…" : "확인"}
          </button>
          {mode === "edit" && (
            <button
              type="button"
              className="grid h-11 place-items-center rounded-lg bg-surface-container text-sm font-bold text-on-surface"
              onClick={onClose}
            >
              취소
            </button>
          )}
        </div>
      </form>
      {/* 탈퇴는 계정 설정에 속한다. 처음 이름을 정하는 화면에는 둘 이유가 없다. */}
      {mode === "edit" && onWithdrawn && (
        <div className="mt-4 border-t border-outline-variant pt-3 text-center">
          <button
            type="button"
            className="h-9 px-2 text-xs text-on-surface-variant underline"
            onClick={() => setConfirmingWithdraw(true)}
          >
            회원 탈퇴
          </button>
        </div>
      )}
      {mode === "create" && onLogout && (
        <div className="mt-4 border-t border-outline-variant pt-3 text-center">
          <button
            type="button"
            className="h-9 px-2 text-xs text-on-surface-variant underline"
            onClick={onLogout}
          >
            나중에 할게요 (로그아웃)
          </button>
        </div>
      )}
    </Dialog>
  );
}
