"use client";

import { useState } from "react";

type TournamentApplicationStatus =
  | "APPLIED"
  | "VERIFYING"
  | "WAITING_PAYMENT"
  | "APPROVED"
  | "REJECTED";

const STATUS_LABELS: Record<TournamentApplicationStatus, string> = {
  APPLIED: "신청접수",
  VERIFYING: "검토중",
  WAITING_PAYMENT: "입금대기",
  APPROVED: "참가자",
  REJECTED: "거절",
};

function statusHeadline(s: TournamentApplicationStatus): string {
  if (s === "APPROVED") return "참가자";
  if (s === "REJECTED") return "거절";
  return "신청자";
}

const NEXT_STATUS_MAP: Record<TournamentApplicationStatus, TournamentApplicationStatus[]> = {
  APPLIED: ["VERIFYING", "REJECTED"],
  VERIFYING: ["WAITING_PAYMENT", "REJECTED"],
  WAITING_PAYMENT: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export default function StatusTransitionControls({
  tournamentId,
  entryId,
  initialStatus,
}: {
  tournamentId: string;
  entryId: string;
  initialStatus: TournamentApplicationStatus;
}) {
  const [status, setStatus] = useState<TournamentApplicationStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const nextStatuses = NEXT_STATUS_MAP[status];

  async function handleTransition(nextStatus: TournamentApplicationStatus) {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/participants/${entryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextStatus }),
      });
      const result = (await response.json()) as {
        error?: string;
        application?: { status?: TournamentApplicationStatus };
      };
      if (!response.ok) {
        setMessage(result.error ?? "상태 변경에 실패했습니다.");
        return;
      }
      const updatedStatus = result.application?.status ?? nextStatus;
      setStatus(updatedStatus);
      setMessage(`상태가 ${statusHeadline(updatedStatus)}(으)로 변경되었습니다.`);
    } catch {
      setMessage("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="v3-box v3-stack">
      <h2 className="v3-h2">운영 상태 처리</h2>
      <p>
        <strong>현재 상태:</strong> {statusHeadline(status)} ({status})
      </p>
      {nextStatuses.length === 0 ? (
        <p className="v3-muted">이 상태에서는 추가 전이가 없습니다.</p>
      ) : (
        <div className="v3-row">
          {nextStatuses.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              className="v3-btn"
              disabled={loading}
              onClick={() => void handleTransition(nextStatus)}
              style={{
                padding: "0.55rem 0.9rem",
                background: nextStatus === "APPROVED" ? "#dff5e6" : "#fff",
                borderColor: nextStatus === "APPROVED" ? "#7dcea0" : "#d7d7d7",
              }}
            >
              {nextStatus === "APPROVED"
                ? "입금확인"
                : nextStatus === "REJECTED"
                  ? "거절"
                  : `${STATUS_LABELS[nextStatus]}로 변경`}
            </button>
          ))}
        </div>
      )}
      {message ? <p className="v3-muted">{message}</p> : null}
    </section>
  );
}
