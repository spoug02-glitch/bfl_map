"use client";

import { useCallback, useEffect, useState } from "react";
import { REPORT_KIND_LABELS, type ReportKind } from "@/lib/reports";

type Report = {
  id: number;
  kind: ReportKind;
  place_id: string | null;
  body: string;
  contact: string | null;
  created_at: string;
};

type OwnerMenu = {
  place_id: string;
  submitted_at: string;
  contact: string | null;
  item_count: number;
  items: { id: number; menuName: string; price: number | null }[];
};

type PlaceName = Record<string, string>;

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR");

function Card({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-outline bg-surface-container-lowest p-4">{children}</li>
  );
}

function Actions({
  busy, onApprove, onReject, approveLabel,
}: { busy: boolean; onApprove: () => void; onReject: () => void; approveLabel: string }) {
  return (
    <div className="mt-3 flex gap-2">
      <button
        className="h-11 flex-1 rounded-lg bg-primary text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 md:h-9"
        disabled={busy}
        onClick={onApprove}
      >
        {approveLabel}
      </button>
      <button
        className="h-11 flex-1 rounded-lg bg-surface-container text-sm font-bold text-on-surface transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 disabled:opacity-50 md:h-9"
        disabled={busy}
        onClick={onReject}
      >
        반려
      </button>
    </div>
  );
}

/**
 * 열린 제보와 승인 대기 업주 메뉴를 처리하는 화면.
 *
 * 이 화면이 방치되면 스펙이 걱정한 그대로 된다 — 접수 창구를 열어놓고 아무도 안
 * 보는 상태. 그래서 대시보드에도 대기 건수를 띄운다.
 */
export default function IntakeQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [ownerMenus, setOwnerMenus] = useState<OwnerMenu[]>([]);
  const [names, setNames] = useState<PlaceName>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/intake")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("불러오지 못했어요."))))
      .then(d => {
        setReports(d.reports ?? []);
        setOwnerMenus(d.ownerMenus ?? []);
        setLoaded(true);
      })
      .catch(e => { setError(e.message); setLoaded(true); });
  }, []);

  useEffect(load, [load]);

  // 가게 이름은 큐에 실제로 등장한 place_id 것만 있으면 된다. 2.6MB 파일을
  // 통째로 들고 있을 이유가 없어 이름만 뽑아 버린다.
  useEffect(() => {
    const ids = new Set([
      ...reports.map(r => r.place_id).filter((v): v is string => v !== null),
      ...ownerMenus.map(o => o.place_id),
    ]);
    if (ids.size === 0) return;
    fetch("/restaurants.json")
      .then(r => r.json())
      .then((rows: { kakao_place_id: string; name: string }[]) => {
        const m: PlaceName = {};
        for (const row of rows) if (ids.has(row.kakao_place_id)) m[row.kakao_place_id] = row.name;
        setNames(m);
      })
      .catch(() => {});
  }, [reports, ownerMenus]);

  const act = async (body: Record<string, unknown>, key: string) => {
    setError("");
    setBusy(key);
    const res = await fetch("/api/admin/intake", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}));
      setError(d?.error ?? "처리하지 못했어요.");
      return;
    }
    load();
  };

  const placeLabel = (id: string) => names[id] ?? `가게 ${id}`;
  const total = reports.length + ownerMenus.length;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-on-surface">
          접수함 {total > 0 && <span className="text-primary">{total}</span>}
        </h2>
        <button
          className="h-11 rounded-lg px-3 text-sm text-on-surface-variant transition-colors hover:bg-on-surface/8 active:bg-on-surface/10 md:h-9"
          onClick={load}
        >
          새로고침
        </button>
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
      {loaded && total === 0 && !error && (
        <p className="mt-2 text-sm text-on-surface-variant">처리할 게 없어요.</p>
      )}

      {ownerMenus.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-bold text-on-surface-variant">
            업주 메뉴 승인 대기 {ownerMenus.length}
          </h3>
          <ul className="mt-2 space-y-2">
            {ownerMenus.map(o => (
              <Card key={o.place_id}>
                <p className="font-bold text-on-surface">{placeLabel(o.place_id)}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {when(o.submitted_at)} · 연락처 {o.contact ?? "없음"}
                </p>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {o.items.map(i => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-on-surface">{i.menuName}</span>
                      <span className="shrink-0 text-price">
                        {i.price === null ? "" : `${i.price.toLocaleString("ko-KR")}원`}
                      </span>
                    </li>
                  ))}
                </ul>
                <Actions
                  busy={busy === `o${o.place_id}`}
                  approveLabel={`${o.item_count}개 승인`}
                  onApprove={() => act({ target: "ownerMenu", decision: "approve", placeId: o.place_id }, `o${o.place_id}`)}
                  onReject={() => act({ target: "ownerMenu", decision: "reject", placeId: o.place_id }, `o${o.place_id}`)}
                />
              </Card>
            ))}
          </ul>
        </>
      )}

      {reports.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-bold text-on-surface-variant">제보 {reports.length}</h3>
          <ul className="mt-2 space-y-2">
            {reports.map(r => (
              <Card key={r.id}>
                <p className="text-xs font-bold text-on-surface-variant">
                  {REPORT_KIND_LABELS[r.kind] ?? r.kind}
                </p>
                {r.place_id && (
                  <p className="mt-0.5 text-sm font-bold text-on-surface">{placeLabel(r.place_id)}</p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">{r.body}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {when(r.created_at)} · 연락처 {r.contact ?? "없음"}
                </p>
                <Actions
                  busy={busy === `r${r.id}`}
                  approveLabel="처리 완료"
                  onApprove={() => act({ target: "report", decision: "approve", id: r.id }, `r${r.id}`)}
                  onReject={() => act({ target: "report", decision: "reject", id: r.id }, `r${r.id}`)}
                />
              </Card>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
