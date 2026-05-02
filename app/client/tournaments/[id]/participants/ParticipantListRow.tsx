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

const actionBtnBase: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: "0 0.55rem",
  fontSize: "0.82rem",
  fontWeight: 700,
  borderRadius: "0.35rem",
  touchAction: "manipulation",
  flexShrink: 0,
};

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

  const showEver = participantAverage != null && Number.isFinite(participantAverage);
  const metaBits: string[] = [];
  if (registrationSource === "admin" && adminNote?.trim()) {
    metaBits.push(`비고: ${adminNote.trim()}`);
  }
  if (createdShort) {
    metaBits.push(registrationSource === "admin" ? `등록 ${createdShort}` : `신청 ${createdShort}`);
  }
  const metaLine = metaBits.join(" · ");

  function renderRightColumn() {
    if (status === "WAITING_PAYMENT") {
      return (
        <div
          style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.25rem" }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="v3-btn"
            disabled={loading}
            onClick={() => void handleTransition("APPROVED")}
            style={{
              ...actionBtnBase,
              background: "#dff5e6",
              borderColor: "#7dcea0",
              color: "#0d5c2e",
            }}
          >
            입금확인
          </button>
          <button
            type="button"
            className="v3-btn"
            disabled={loading}
            onClick={() => void handleTransition("REJECTED")}
            style={{
              ...actionBtnBase,
              background: "#fff",
              borderColor: "#d7d7d7",
              color: "#374151",
            }}
          >
            거절
          </button>
        </div>
      );
    }
    if (status === "APPROVED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 0.45rem",
            fontSize: "0.82rem",
            fontWeight: 800,
            ...statusBadgeStyle(status),
            borderRadius: "0.35rem",
          }}
        >
          승인됨
        </span>
      );
    }
    if (status === "REJECTED") {
      return (
        <span
          className="v3-muted"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            padding: "0 0.45rem",
            fontSize: "0.8rem",
            fontWeight: 700,
          }}
        >
          거절됨
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 44,
          padding: "0.12rem 0.45rem",
          borderRadius: "0.3rem",
          fontSize: "0.78rem",
          fontWeight: 700,
          whiteSpace: "nowrap",
          ...statusBadgeStyle(status),
        }}
      >
        {STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid #e8e8e8",
        background: "#fff",
        touchAction: "manipulation",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.45rem",
          padding: "0.35rem 0.45rem 0.15rem",
          minHeight: 44,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "row",
            alignItems: "baseline",
            gap: "0.35rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.2 }}>{applicantName}</span>
          {registrationSource === "admin" ? (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "0.06rem 0.3rem",
                borderRadius: "0.25rem",
                background: "#eef2ff",
                color: "#3730a3",
                border: "1px solid #c7d2fe",
                lineHeight: 1.2,
              }}
            >
              관리자 등록
            </span>
          ) : null}
          {showEver ? (
            <span className="v3-muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
              에버 {participantAverage}
            </span>
          ) : null}
        </div>
        {renderRightColumn()}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          padding: "0 0.45rem 0.3rem",
        }}
      >
        <span className="v3-muted" style={{ fontSize: "0.78rem", lineHeight: 1.35, wordBreak: "break-all" }}>
          {phone.trim() || "—"}
        </span>
        <Link
          prefetch={false}
          href={detailHref}
          className="v3-btn"
          style={{
            padding: "0.28rem 0.5rem",
            fontSize: "0.76rem",
            fontWeight: 700,
            textDecoration: "none",
            flexShrink: 0,
            touchAction: "manipulation",
          }}
        >
          상세
        </Link>
      </div>

      {metaLine ? (
        <div className="v3-muted" style={{ fontSize: "0.72rem", padding: "0 0.45rem 0.35rem", lineHeight: 1.3 }}>
          {metaLine}
        </div>
      ) : null}
    </div>
  );
}
