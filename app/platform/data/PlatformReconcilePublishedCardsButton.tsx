"use client";

import { useCallback, useState } from "react";

export default function PlatformReconcilePublishedCardsButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/platform/data/reconcile-published-cards", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        changedRowCount?: number;
        uniqueTournamentIds?: number;
        snapshotFieldAlignmentChanged?: number;
        error?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? `요청 실패 (${res.status})`);
        return;
      }
      const align =
        typeof data.snapshotFieldAlignmentChanged === "number" && data.snapshotFieldAlignmentChanged > 0
          ? ` · 배지/메인노출 정렬 ${data.snapshotFieldAlignmentChanged}건`
          : "";
      setMessage(
        `완료: 변경 ${typeof data.changedRowCount === "number" ? data.changedRowCount : "?"}건 · 대회 ID ${typeof data.uniqueTournamentIds === "number" ? data.uniqueTournamentIds : "?"}개 기준${align}`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "실행 중 오류");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <div className="v3-stack" style={{ gap: "0.5rem" }}>
      <button type="button" className="v3-btn" disabled={busy} onClick={onClick}>
        {busy ? "처리 중…" : "게시카드 메인 비활성 전체 점검"}
      </button>
      {message ? <p className="v3-muted">{message}</p> : null}
    </div>
  );
}
