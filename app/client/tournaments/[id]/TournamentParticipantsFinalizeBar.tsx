"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TournamentStatusBadge } from "../../../../lib/types/entities";

const CLOSED_BADGES: TournamentStatusBadge[] = ["마감", "진행중", "종료"];

export default function TournamentParticipantsFinalizeBar({
  tournamentId,
  tournamentStatusBadge,
  approvedCount,
}: {
  tournamentId: string;
  tournamentStatusBadge: TournamentStatusBadge;
  approvedCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (CLOSED_BADGES.includes(tournamentStatusBadge)) return null;

  async function onFinalize() {
    if (busy) return;
    if (
      !window.confirm(
        "참가자를 확정하시겠습니까?\n확정 후에는 신청이 마감되며 대진표 생성이 활성화됩니다.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const pr = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/promote-confirmed`, {
        method: "POST",
        credentials: "same-origin",
      });
      const pj = (await pr.json()) as { error?: string; promoted?: number };
      if (!pr.ok) {
        window.alert(pj.error ?? "참가자 반영에 실패했습니다.");
        return;
      }

      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/status-badge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusBadge: "마감" }),
        credentials: "same-origin",
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
      className="v3-row"
      style={{
        flexWrap: "wrap",
        gap: "0.45rem",
        alignItems: "center",
        marginBottom: "0.55rem",
        padding: "0.55rem 0.65rem",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <button type="button" className="ui-btn-primary-solid" disabled={busy} onClick={() => void onFinalize()} style={{ fontWeight: 800 }}>
        {busy ? "처리 중…" : "참가자 확정"}
      </button>
      <span className="v3-muted" style={{ margin: 0, fontSize: "0.82rem", flex: "1 1 12rem" }}>
        현재 참가 확정(APPROVED) {approvedCount}명 · 확정 시 신청 승인 처리된 인원을 참가자로 반영한 뒤 신청을 마감하고 대진표 단계로 진행합니다.
      </span>
      <Link prefetch={false} href={`/client/tournaments/${encodeURIComponent(tournamentId)}`} className="v3-btn" style={{ textDecoration: "none", fontWeight: 700 }}>
        대회 관리 홈
      </Link>
    </div>
  );
}
