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
  APPLIED: "신청자",
  VERIFYING: "신청자",
  WAITING_PAYMENT: "신청자",
  APPROVED: "참가자",
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
  minHeight: 32,
  minWidth: 32,
  padding: "0 0.4rem",
  fontSize: "0.72rem",
  fontWeight: 700,
  borderRadius: "0.3rem",
  touchAction: "manipulation",
  flexShrink: 0,
};

const cellBase: CSSProperties = {
  padding: "0.2rem 0.28rem",
  fontSize: "0.84rem",
  verticalAlign: "middle",
  borderBottom: "1px solid #e8e8e8",
};

function formatDepositMd(status: TournamentApplicationStatus, statusChangedAt?: string): string {
  if (status !== "APPROVED") return "—";
  const raw = (statusChangedAt ?? "").trim();
  if (!raw) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${Number(iso[2])}/${Number(iso[3])}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`;
  return "—";
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
  statusChangedAt,
  attendanceChecked: attendanceCheckedProp,
  groupDraft,
  onGroupDraftChange,
  zonesEnabled = false,
  zones = [],
  initialZoneId = null,
  onZoneIdUpdated,
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
  statusChangedAt?: string;
  attendanceChecked?: boolean | null;
  groupDraft: string;
  onGroupDraftChange: (entryId: string, value: string) => void;
  zonesEnabled?: boolean;
  zones?: { id: string; zoneName: string }[];
  initialZoneId?: string | null;
  onZoneIdUpdated?: (entryId: string, zoneId: string | null) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TournamentApplicationStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [attendanceChecked, setAttendanceChecked] = useState(attendanceCheckedProp === true);
  const [attendancePending, setAttendancePending] = useState(false);
  const [zoneSelect, setZoneSelect] = useState(() => (initialZoneId && String(initialZoneId).trim() !== "" ? String(initialZoneId).trim() : ""));
  const [zonePending, setZonePending] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setAttendanceChecked(attendanceCheckedProp === true);
  }, [attendanceCheckedProp]);

  useEffect(() => {
    const z = initialZoneId && String(initialZoneId).trim() !== "" ? String(initialZoneId).trim() : "";
    setZoneSelect(z);
  }, [initialZoneId]);

  const detailHref = `/client/tournaments/${tournamentId}/participants/${entryId}`;

  async function patchZone(nextSelect: string) {
    if (!zonesEnabled || !onZoneIdUpdated) return;
    const nextZoneId = nextSelect.trim() === "" ? null : nextSelect.trim();
    const prevSelect = zoneSelect;
    setZoneSelect(nextSelect.trim() === "" ? "" : nextSelect.trim());
    setZonePending(true);
    try {
      const response = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tournamentId)}/applications/${encodeURIComponent(entryId)}/zone`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zoneId: nextZoneId }),
        }
      );
      const result = (await response.json()) as { error?: string; ok?: boolean; zoneId?: string | null };
      if (!response.ok) {
        window.alert(result.error ?? "권역 저장에 실패했습니다.");
        setZoneSelect(prevSelect);
        return;
      }
      onZoneIdUpdated(entryId, result.zoneId !== undefined ? result.zoneId : nextZoneId);
    } catch {
      window.alert("권역 저장 중 오류가 발생했습니다.");
      setZoneSelect(prevSelect);
    } finally {
      setZonePending(false);
    }
  }

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

  async function patchAttendance(next: boolean) {
    const prev = attendanceChecked;
    if (prev && !next) {
      if (!window.confirm("출석 체크를 해제할까요?")) return;
    }
    setAttendancePending(true);
    try {
      const response = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(entryId)}/attendance`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checked: next }),
        }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        window.alert(result.error ?? "출석 저장에 실패했습니다.");
        return;
      }
      setAttendanceChecked(next);
      router.refresh();
    } catch {
      window.alert("출석 저장 중 오류가 발생했습니다.");
    } finally {
      setAttendancePending(false);
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

  function renderNameCellActions() {
    if (status === "WAITING_PAYMENT") {
      return (
        <span style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: "0.25rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
        </span>
      );
    }
    if (status === "APPROVED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 28,
            padding: "0 0.35rem",
            fontSize: "0.7rem",
            fontWeight: 800,
            ...statusBadgeStyle(status),
            borderRadius: "0.3rem",
          }}
        >
          참가자
        </span>
      );
    }
    if (status === "REJECTED") {
      return (
        <span className="v3-muted" style={{ fontSize: "0.68rem", fontWeight: 700 }}>
          거절됨
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 28,
          padding: "0.08rem 0.35rem",
          borderRadius: "0.25rem",
          fontSize: "0.68rem",
          fontWeight: 700,
          whiteSpace: "nowrap",
          ...statusBadgeStyle(status),
        }}
      >
        {STATUS_LABELS[status]}
      </span>
    );
  }

  const depositCell = formatDepositMd(status, statusChangedAt);
  const scoreCell = showEver ? String(participantAverage) : "—";

  const detailBtnStyle: CSSProperties = {
    padding: "0.2rem 0.45rem",
    fontSize: "0.75rem",
    fontWeight: 700,
    textDecoration: "none",
    flexShrink: 0,
    touchAction: "manipulation",
  };

  return (
    <tr style={{ background: "#fff" }}>
      <td data-participant-label="이름" style={{ ...cellBase, whiteSpace: "nowrap", minWidth: 0 }}>
        <div className="client-tournament-manage__nameCell">
          <div className="client-tournament-manage__nameRow1">
            <div className="client-tournament-manage__nameLeft">
              <span
                style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
                title={metaLine || undefined}
              >
                {applicantName}
              </span>
              {registrationSource === "admin" ? (
                <span
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    padding: "0.04rem 0.25rem",
                    borderRadius: "0.2rem",
                    background: "#eef2ff",
                    color: "#3730a3",
                    border: "1px solid #c7d2fe",
                    flexShrink: 0,
                  }}
                >
                  관리자 등록
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.28rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div className="client-tournament-manage__nameStatus">{renderNameCellActions()}</div>
              <Link prefetch={false} href={detailHref} className="v3-btn client-tournament-manage__detailDesktop" style={detailBtnStyle}>
                상세
              </Link>
            </div>
          </div>
          <div className="client-tournament-manage__detailMobile">
            <Link prefetch={false} href={detailHref} className="v3-btn" style={detailBtnStyle}>
              상세
            </Link>
          </div>
        </div>
      </td>
      <td
        data-participant-label="점수/에버"
        style={{
          ...cellBase,
          whiteSpace: "nowrap",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "4rem",
        }}
        title={showEver ? String(participantAverage) : undefined}
      >
        {scoreCell}
      </td>
      <td
        data-participant-label="전화번호"
        style={{
          ...cellBase,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "6.75rem",
        }}
        title={phone.trim() || undefined}
      >
        {phone.trim() || "—"}
      </td>
      <td
        data-participant-label="입금일"
        style={{
          ...cellBase,
          whiteSpace: "nowrap",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "3rem",
        }}
        title={depositCell !== "—" ? depositCell : undefined}
      >
        {depositCell}
      </td>
      {zonesEnabled ? (
        <td data-participant-label="권역" style={{ ...cellBase, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", maxWidth: "6.5rem" }}>
          {zones.length === 0 ? (
            <span className="v3-muted" style={{ fontSize: "0.72rem" }}>
              —
            </span>
          ) : (
            <select
              value={zoneSelect}
              disabled={zonePending}
              onChange={(e) => void patchZone(e.target.value)}
              aria-label={`${applicantName} 권역`}
              style={{
                width: "100%",
                maxWidth: "6.25rem",
                padding: "0.12rem 0.2rem",
                fontSize: "0.72rem",
                fontWeight: 600,
                border: "1px solid #cbd5e1",
                borderRadius: "0.25rem",
                boxSizing: "border-box",
                background: zonePending ? "#f1f5f9" : "#fff",
              }}
            >
              <option value="">미배정</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zoneName}
                </option>
              ))}
            </select>
          )}
        </td>
      ) : null}
      <td data-participant-label="조" style={{ ...cellBase, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", maxWidth: "2.85rem" }}>
        <input
          type="number"
          min={1}
          max={999}
          inputMode="numeric"
          placeholder=""
          value={groupDraft}
          onChange={(e) => onGroupDraftChange(entryId, e.target.value)}
          style={{
            width: "2.85rem",
            maxWidth: "100%",
            padding: "0.1rem 0.15rem",
            fontSize: "0.78rem",
            border: "1px solid #cbd5e1",
            borderRadius: "0.25rem",
            textAlign: "center",
            boxSizing: "border-box",
          }}
          aria-label={`${applicantName} 조번호`}
        />
      </td>
      <td data-participant-label="출석" style={{ ...cellBase, textAlign: "center", whiteSpace: "nowrap" }}>
        {status === "APPROVED" ? (
          <input
            type="checkbox"
            checked={attendanceChecked}
            disabled={attendancePending}
            onChange={(e) => void patchAttendance(e.target.checked)}
            style={{ width: "1.15rem", height: "1.15rem", cursor: "pointer" }}
            aria-label={`${applicantName} 출석`}
          />
        ) : (
          <span className="v3-muted" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
            —
          </span>
        )}
      </td>
    </tr>
  );
}
