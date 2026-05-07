"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

type TournamentApplicationStatus =
  | "APPLIED"
  | "VERIFYING"
  | "WAITING_PAYMENT"
  | "APPROVED"
  | "REJECTED";

const STATUS_LABELS: Record<TournamentApplicationStatus, string> = {
  APPLIED: "신청자",
  VERIFYING: "신청자",
  WAITING_PAYMENT: "입금대기",
  APPROVED: "참가자",
  REJECTED: "거절",
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatRegistrationInstantUtc(iso: string): string {
  const raw = iso.trim();
  if (!raw) return "—";
  const d = new Date(raw);
  const t = d.getTime();
  if (Number.isNaN(t)) return raw;
  return `${d.getUTCFullYear()}.${pad2(d.getUTCMonth() + 1)}.${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function formatDepositMd(status: TournamentApplicationStatus, statusChangedAt?: string): string {
  if (status !== "APPROVED") return "—";
  const raw = (statusChangedAt ?? "").trim();
  if (!raw) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${Number(iso[2])}/${Number(iso[3])} (상태확인일)`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (상태확인일)`;
  return "—";
}

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "6.5rem 1fr",
  gap: "0.35rem 0.65rem",
  fontSize: "0.88rem",
  alignItems: "start",
};

const labelStyle: CSSProperties = { fontWeight: 800, color: "#64748b", fontSize: "0.8rem" };

export default function ParticipantApplicationDetailModal({
  open,
  onClose,
  tournamentId,
  entryId,
  applicantName,
  depositorName,
  status,
  phone,
  registrationCreatedAt,
  registrationSource,
  participantAverage,
  adminNote,
  statusChangedAt,
  attendanceChecked,
}: {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  entryId: string;
  applicantName: string;
  depositorName?: string;
  status: TournamentApplicationStatus;
  phone: string;
  registrationCreatedAt: string;
  registrationSource?: "admin" | null;
  participantAverage?: number | null;
  adminNote?: string | null;
  statusChangedAt?: string;
  attendanceChecked?: boolean | null;
}) {
  if (!open) return null;

  const fullPageHref = `/client/tournaments/${tournamentId}/participants/${entryId}`;
  const showEver = participantAverage != null && Number.isFinite(participantAverage);
  const depositLine = formatDepositMd(status, statusChangedAt);

  return (
    <div
      className="client-tournament-manage__participantDetailBackdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="client-tournament-manage__participantDetailModal" role="dialog" aria-modal="true" aria-label="참가 신청 상세">
        <div className="client-tournament-manage__participantDetailHead">
          <h2 className="client-tournament-manage__participantDetailTitle">신청 상세</h2>
          <button type="button" className="v3-btn" onClick={onClose}>
            닫기
          </button>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>이름</span>
          <span style={{ fontWeight: 800 }}>{applicantName}</span>

          <span style={labelStyle}>전화번호</span>
          <span>{phone.trim() || "—"}</span>

          <span style={labelStyle}>입금자</span>
          <span>{typeof depositorName === "string" && depositorName.trim() ? depositorName.trim() : "—"}</span>

          <span style={labelStyle}>상태</span>
          <span>
            {STATUS_LABELS[status]} <span className="v3-muted" style={{ fontSize: "0.78rem" }}>({status})</span>
          </span>

          <span style={labelStyle}>입금</span>
          <span>{depositLine}</span>

          <span style={labelStyle}>신청일</span>
          <span>{formatRegistrationInstantUtc(registrationCreatedAt)}</span>

          {registrationSource === "admin" ? (
            <>
              <span style={labelStyle}>등록</span>
              <span>관리자 등록</span>
            </>
          ) : null}

          {showEver ? (
            <>
              <span style={labelStyle}>에버</span>
              <span>{String(participantAverage)}</span>
            </>
          ) : null}

          {status === "APPROVED" ? (
            <>
              <span style={labelStyle}>출석</span>
              <span>{attendanceChecked === true ? "체크됨" : "미체크"}</span>
            </>
          ) : null}

          <span style={labelStyle}>메모</span>
          <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{adminNote?.trim() || "—"}</span>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link prefetch={false} href={fullPageHref} className="v3-btn" onClick={onClose}>
            증빙·OCR 전체 페이지
          </Link>
        </div>
      </div>
    </div>
  );
}
