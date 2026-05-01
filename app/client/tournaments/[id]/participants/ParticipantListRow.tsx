"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

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
  APPROVED: "승인완료",
  REJECTED: "거절",
};

const NEXT_STATUS_MAP: Record<TournamentApplicationStatus, TournamentApplicationStatus[]> = {
  APPLIED: ["VERIFYING", "REJECTED"],
  VERIFYING: ["WAITING_PAYMENT", "REJECTED"],
  WAITING_PAYMENT: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

function statusBadgeStyle(status: TournamentApplicationStatus): CSSProperties {
  if (status === "APPROVED") {
    return { background: "#dff5e6", color: "#0d5c2e", border: "1px solid #7dcea0" };
  }
  if (status === "WAITING_PAYMENT") {
    return { background: "#fef3c7", color: "#b45309", border: "1px solid #fbbf24" };
  }
  if (status === "REJECTED") {
    return { background: "#f3f4f6", color: "#6b7280", border: "1px solid #d1d5db" };
  }
  return { background: "#eff6ff", color: "#1e3a5f", border: "1px solid #bfdbfe" };
}

export default function ParticipantListRow({
  tournamentId,
  entryId,
  applicantName,
  initialStatus,
  phone,
  createdShort,
  registrationSource,
  participantAverage,
  adminNote,
}: {
  tournamentId: string;
  entryId: string;
  applicantName: string;
  initialStatus: TournamentApplicationStatus;
  phone: string;
  createdShort: string;
  registrationSource?: "admin" | null;
  participantAverage?: number | null;
  adminNote?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TournamentApplicationStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const detailHref = `/client/tournaments/${tournamentId}/participants/${entryId}`;
  const nextStatuses = NEXT_STATUS_MAP[status];

  async function handleTransition(nextStatus: TournamentApplicationStatus) {
    if (loading) return;
    setLoading(true);
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
        window.alert(result.error ?? "상태 변경에 실패했습니다.");
        return;
      }
      const updatedStatus = result.application?.status ?? nextStatus;
      setStatus(updatedStatus);
      router.refresh();
    } catch {
      window.alert("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: "1px solid #e8e8e8",
        background: "#fff",
        cursor: "pointer",
      }}
      onClick={() => router.push(detailHref)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(detailHref);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "0.55rem 0.65rem",
          textAlign: "left",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "0.98rem", marginBottom: "0.3rem" }}>
          {applicantName}
          {registrationSource === "admin" ? (
            <span
              style={{
                marginLeft: "0.35rem",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.08rem 0.35rem",
                borderRadius: "0.25rem",
                background: "#eef2ff",
                color: "#3730a3",
                border: "1px solid #c7d2fe",
                verticalAlign: "middle",
              }}
            >
              관리자 등록
            </span>
          ) : null}
        </div>
        <span
          style={{
            display: "inline-block",
            padding: "0.12rem 0.45rem",
            borderRadius: "0.3rem",
            fontSize: "0.78rem",
            fontWeight: 700,
            ...statusBadgeStyle(status),
          }}
        >
          {STATUS_LABELS[status]} · {status}
        </span>
        <div className="v3-muted" style={{ fontSize: "0.82rem", marginTop: "0.35rem", lineHeight: 1.35 }}>
          {registrationSource === "admin" ? (
            <>
              {participantAverage != null && Number.isFinite(participantAverage) ? (
                <span>에버 {participantAverage}</span>
              ) : null}
              {phone.trim() ? (
                <span>
                  {participantAverage != null && Number.isFinite(participantAverage) ? " · " : null}
                  {phone}
                </span>
              ) : null}
              {adminNote?.trim() ? (
                <>
                  <br />
                  <span>비고: {adminNote.trim()}</span>
                </>
              ) : null}
              {createdShort ? (
                <>
                  <br />
                  <span>등록 {createdShort}</span>
                </>
              ) : null}
            </>
          ) : (
            <span>
              {phone}
              {createdShort ? ` · 신청 ${createdShort}` : null}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "center",
          gap: "0.35rem",
          padding: "0.45rem 0.5rem",
          flexShrink: 0,
          borderLeft: "1px solid #eee",
          maxWidth: "11rem",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {nextStatuses.length > 0 ? (
          <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.3rem", justifyContent: "flex-end" }}>
            {nextStatuses.map((nextStatus) => (
              <button
                key={nextStatus}
                type="button"
                className="v3-btn"
                disabled={loading}
                onClick={() => void handleTransition(nextStatus)}
                style={{
                  padding: "0.45rem 0.55rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  background: nextStatus === "APPROVED" ? "#dff5e6" : "#fff",
                  borderColor: nextStatus === "APPROVED" ? "#7dcea0" : "#d7d7d7",
                }}
              >
                {nextStatus === "APPROVED" ? "입금확인" : `${STATUS_LABELS[nextStatus]}`}
              </button>
            ))}
          </div>
        ) : (
          <span className="v3-muted" style={{ fontSize: "0.78rem", textAlign: "right" }}>
            처리 완료
          </span>
        )}
        <Link
          className="v3-btn"
          href={detailHref}
          style={{
            padding: "0.5rem 0.65rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          상세 보기
        </Link>
      </div>
    </div>
  );
}
