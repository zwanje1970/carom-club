"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TournamentStatusBadge } from "../../../../lib/types/entities";

export default function TournamentOperationalStartStrip({
  tournamentId,
  statusBadge,
  hasConfirmedBracket,
}: {
  tournamentId: string;
  statusBadge: TournamentStatusBadge;
  hasConfirmedBracket: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (statusBadge !== "마감" || !hasConfirmedBracket) return null;

  async function onStart() {
    if (busy) return;
    if (
      !window.confirm(
        "대회를 개시하면 상태가 「진행중」으로 바뀝니다.\n운영(결과 입력·TV·출석) 메뉴가 활성화됩니다. 계속하시겠습니까?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusBadge: "진행중" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "저장에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="v3-box v3-stack"
      style={{
        padding: "0.65rem 0.75rem",
        marginBottom: "0.35rem",
        background: "linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%)",
        border: "1px solid #c7d2fe",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "#312e81" }}>대회 개시</p>
      <p className="v3-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", lineHeight: 1.45 }}>
        대진표가 준비되었습니다. 현장 운영을 시작하면 「진행중」으로 전환합니다.
      </p>
      <button type="button" className="ui-btn-primary-solid" disabled={busy} onClick={() => void onStart()} style={{ marginTop: "0.45rem", fontWeight: 700 }}>
        {busy ? "처리 중…" : "대회개시 (진행중으로 전환)"}
      </button>
    </div>
  );
}
