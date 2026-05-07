"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import ParticipantApplicationDetailModal from "./ParticipantApplicationDetailModal";

type TournamentApplicationStatus =
  | "APPLIED"
  | "VERIFYING"
  | "WAITING_PAYMENT"
  | "APPROVED"
  | "REJECTED";

/** 신청일·승인일 공통 — 월/일만, 앞자리 0 없음 (예: 12/25). 시간 없음. */
function formatDateSlashMd(iso: string | null | undefined): string {
  const raw = (iso ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const procBtnBase: CSSProperties = {
  minHeight: 28,
  minWidth: "3rem",
  padding: "0.06rem 0.18rem",
  fontSize: "0.58rem",
  fontWeight: 800,
  borderRadius: "0.2rem",
  touchAction: "manipulation",
  flexShrink: 0,
  whiteSpace: "nowrap",
  borderWidth: 1,
  borderStyle: "solid",
  boxShadow: "none",
};

const cellBase: CSSProperties = {
  padding: "0.2rem 0.14rem",
  fontSize: "0.74rem",
  verticalAlign: "middle",
  borderBottom: "1px solid #e8e8e8",
  textAlign: "center",
};

export default function ParticipantListRow({
  tournamentId,
  entryId,
  applicantName,
  depositorName,
  affiliation,
  initialStatus,
  phone,
  registrationCreatedAt,
  registrationSource,
  participantAverage,
  metricColumnTitle,
  approveActionColumnLabel = "처리",
  adminNote,
  statusChangedAt,
  initialClientDepositConfirmedAt,
  initialClientApplicationApprovedAt,
  attendanceChecked,
}: {
  tournamentId: string;
  entryId: string;
  applicantName: string;
  depositorName?: string | null;
  affiliation?: string | null;
  initialStatus: TournamentApplicationStatus;
  phone: string;
  registrationCreatedAt: string;
  registrationSource?: "admin" | null;
  participantAverage?: number | null;
  metricColumnTitle: string;
  /** 신청 승인 버튼 열 헤더(표에서는 「승인일」열과 구분) */
  approveActionColumnLabel?: string;
  adminNote?: string | null;
  statusChangedAt?: string;
  initialClientDepositConfirmedAt?: string | null;
  initialClientApplicationApprovedAt?: string | null;
  attendanceChecked?: boolean | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TournamentApplicationStatus>(initialStatus);
  const [clientDepositConfirmedAt, setClientDepositConfirmedAt] = useState<string | null>(
    initialClientDepositConfirmedAt ?? null,
  );
  const [clientApplicationApprovedAt, setClientApplicationApprovedAt] = useState<string | null>(
    initialClientApplicationApprovedAt ?? null,
  );
  const [loading, setLoading] = useState(false);
  /** 입금확인(true) PATCH 진행 중 — 승인 버튼은 켜 두되, 입금해제는 막음 */
  const [depositConfirmSaving, setDepositConfirmSaving] = useState(false);
  const depositConfirmInflightRef = useRef<Promise<void> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setClientDepositConfirmedAt(initialClientDepositConfirmedAt ?? null);
  }, [initialClientDepositConfirmedAt]);

  useEffect(() => {
    setClientApplicationApprovedAt(initialClientApplicationApprovedAt ?? null);
  }, [initialClientApplicationApprovedAt]);

  const terminalRejected = status === "REJECTED";
  const terminalApproved = status === "APPROVED";

  const depositDone =
    terminalApproved ||
    (typeof clientDepositConfirmedAt === "string" && clientDepositConfirmedAt.trim() !== "");
  const approveDone =
    terminalApproved ||
    (typeof clientApplicationApprovedAt === "string" && clientApplicationApprovedAt.trim() !== "");

  async function patchProcessing(patch: { depositConfirmed?: boolean; applicationApproved?: boolean }) {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(entryId)}/processing`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
          credentials: "same-origin",
        },
      );
      const result = (await response.json()) as {
        error?: string;
        application?: {
          status?: TournamentApplicationStatus;
          clientDepositConfirmedAt?: string | null;
          clientApplicationApprovedAt?: string | null;
        };
      };
      if (!response.ok) {
        window.alert(result.error ?? "저장에 실패했습니다.");
        return;
      }
      const app = result.application;
      if (app?.status) setStatus(app.status);
      if (app && "clientDepositConfirmedAt" in app) {
        setClientDepositConfirmedAt(
          typeof app.clientDepositConfirmedAt === "string" && app.clientDepositConfirmedAt.trim()
            ? app.clientDepositConfirmedAt.trim()
            : null,
        );
      }
      if (app && "clientApplicationApprovedAt" in app) {
        setClientApplicationApprovedAt(
          typeof app.clientApplicationApprovedAt === "string" && app.clientApplicationApprovedAt.trim()
            ? app.clientApplicationApprovedAt.trim()
            : null,
        );
      }
      router.refresh();
    } catch {
      window.alert("처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTransition(nextStatus: TournamentApplicationStatus, rejectReason?: string) {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/client/tournaments/${tournamentId}/participants/${entryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextStatus,
          ...(nextStatus === "REJECTED" && rejectReason ? { rejectReason } : {}),
        }),
        credentials: "same-origin",
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

  function runDepositConfirmOptimistic() {
    if (depositConfirmInflightRef.current != null) return;
    const prevAt = clientDepositConfirmedAt;
    const optimisticAt = new Date().toISOString();
    setClientDepositConfirmedAt(optimisticAt);

    const p = (async () => {
      try {
        const response = await fetch(
          `/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(entryId)}/processing`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ depositConfirmed: true }),
            credentials: "same-origin",
          },
        );
        const result = (await response.json()) as {
          error?: string;
          application?: {
            status?: TournamentApplicationStatus;
            clientDepositConfirmedAt?: string | null;
            clientApplicationApprovedAt?: string | null;
          };
        };
        if (!response.ok) {
          setClientDepositConfirmedAt(prevAt);
          window.alert(result.error ?? "저장에 실패했습니다.");
          throw new Error("deposit-fail");
        }
        const app = result.application;
        if (app?.status) setStatus(app.status);
        if (app && "clientDepositConfirmedAt" in app) {
          setClientDepositConfirmedAt(
            typeof app.clientDepositConfirmedAt === "string" && app.clientDepositConfirmedAt.trim()
              ? app.clientDepositConfirmedAt.trim()
              : null,
          );
        }
        if (app && "clientApplicationApprovedAt" in app) {
          setClientApplicationApprovedAt(
            typeof app.clientApplicationApprovedAt === "string" && app.clientApplicationApprovedAt.trim()
              ? app.clientApplicationApprovedAt.trim()
              : null,
          );
        }
        router.refresh();
      } catch (e) {
        if (!(e instanceof Error && e.message === "deposit-fail")) {
          setClientDepositConfirmedAt(prevAt);
          window.alert("처리 중 오류가 발생했습니다.");
        }
        throw e;
      }
    })();

    depositConfirmInflightRef.current = p;
    setDepositConfirmSaving(true);
    void p.finally(() => {
      setDepositConfirmSaving(false);
      if (depositConfirmInflightRef.current === p) {
        depositConfirmInflightRef.current = null;
      }
    });
  }

  function onDepositClick() {
    if (terminalRejected || terminalApproved) return;
    if (!depositDone) {
      runDepositConfirmOptimistic();
      return;
    }
    if (!window.confirm("입금확인을 해제할까요? 신청 승인도 함께 해제됩니다.")) return;
    void patchProcessing({ depositConfirmed: false });
  }

  function onApproveClick() {
    if (terminalRejected || terminalApproved) return;
    if (!depositDone) return;
    if (!approveDone) {
      void (async () => {
        const inflight = depositConfirmInflightRef.current;
        if (inflight) {
          try {
            await inflight;
          } catch {
            return;
          }
        }
        await patchProcessing({ applicationApproved: true });
      })();
      return;
    }
    if (!window.confirm("신청 승인을 해제할까요?")) return;
    void patchProcessing({ applicationApproved: false });
  }

  function onCancelRejectClick() {
    if (terminalRejected || terminalApproved || loading) return;
    const raw = window.prompt("운영자 거절 사유를 입력하세요. 비우면 신청자 취소로 기록합니다.") ?? null;
    if (raw === null) return;
    const rejectReason = raw.trim() === "" ? "[신청자 취소]" : raw.trim();
    void handleTransition("REJECTED", rejectReason);
  }

  function depositButton() {
    if (terminalApproved) {
      return (
        <button type="button" disabled className="v3-appProcBtn v3-appProcBtn--depositDone" style={procBtnBase}>
          입금완료
        </button>
      );
    }
    if (terminalRejected) {
      return (
        <button type="button" disabled className="v3-appProcBtn v3-appProcBtn--muted" style={procBtnBase}>
          입금확인
        </button>
      );
    }
    if (!depositDone) {
      return (
        <button
          type="button"
          disabled={loading}
          className="v3-appProcBtn v3-appProcBtn--depositIdle"
          style={procBtnBase}
          onClick={() => onDepositClick()}
        >
          입금확인
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={loading || depositConfirmSaving}
        className="v3-appProcBtn v3-appProcBtn--depositDone"
        style={procBtnBase}
        onClick={() => onDepositClick()}
      >
        입금완료
      </button>
    );
  }

  function approveButton() {
    if (terminalApproved) {
      return (
        <button type="button" disabled className="v3-appProcBtn v3-appProcBtn--approveDone" style={procBtnBase}>
          승인완료
        </button>
      );
    }
    if (terminalRejected) {
      return (
        <button type="button" disabled className="v3-appProcBtn v3-appProcBtn--muted" style={procBtnBase}>
          승인
        </button>
      );
    }
    if (!depositDone) {
      return (
        <button type="button" disabled className="v3-appProcBtn v3-appProcBtn--approveIdleDisabled" style={procBtnBase}>
          승인
        </button>
      );
    }
    if (!approveDone) {
      return (
        <button
          type="button"
          disabled={loading}
          className="v3-appProcBtn v3-appProcBtn--approveReady"
          style={procBtnBase}
          onClick={() => onApproveClick()}
        >
          승인
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={loading}
        className="v3-appProcBtn v3-appProcBtn--approveDone"
        style={procBtnBase}
        onClick={() => onApproveClick()}
      >
        승인완료
      </button>
    );
  }

  function cancelRejectButton() {
    if (terminalApproved) {
      return (
        <button type="button" disabled className="v3-appProcBtn v3-appProcBtn--muted" style={procBtnBase}>
          취소/거절
        </button>
      );
    }
    if (terminalRejected) {
      return (
        <button type="button" disabled className="v3-appProcBtn v3-appProcBtn--rejectDone" style={procBtnBase}>
          취소/거절
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={loading}
        className="v3-appProcBtn v3-appProcBtn--rejectIdle"
        style={procBtnBase}
        onClick={() => onCancelRejectClick()}
      >
        취소/거절
      </button>
    );
  }

  const depositorDisplay = (typeof depositorName === "string" ? depositorName.trim() : "") || "—";
  const affiliationDisplay = (typeof affiliation === "string" ? affiliation.trim() : "") || "—";
  const metricDisplay =
    participantAverage != null && Number.isFinite(participantAverage) ? String(participantAverage) : "—";

  const approveMdIso =
    terminalApproved && !(clientApplicationApprovedAt ?? "").trim()
      ? statusChangedAt
      : clientApplicationApprovedAt;
  const approveMd = formatDateSlashMd(approveMdIso);

  const rowBg = terminalRejected ? "#f3f4f6" : "#fff";

  const modalEl =
    detailOpen && typeof document !== "undefined"
      ? createPortal(
          <ParticipantApplicationDetailModal
            open
            onClose={() => setDetailOpen(false)}
            tournamentId={tournamentId}
            entryId={entryId}
            applicantName={applicantName}
            depositorName={depositorDisplay !== "—" ? depositorDisplay : ""}
            affiliation={affiliationDisplay !== "—" ? affiliationDisplay : ""}
            status={status}
            phone={phone}
            registrationCreatedAt={registrationCreatedAt}
            registrationSource={registrationSource}
            participantAverage={participantAverage}
            adminNote={adminNote}
            statusChangedAt={statusChangedAt}
            clientDepositConfirmedAt={clientDepositConfirmedAt}
            clientApplicationApprovedAt={clientApplicationApprovedAt}
            attendanceChecked={attendanceChecked}
          />,
          document.body,
        )
      : null;

  return (
    <>
      <tr className={terminalRejected ? "participant-row--rejected" : undefined} style={{ background: rowBg }}>
        <td data-participant-label="신청" style={{ ...cellBase, fontVariantNumeric: "tabular-nums" }}>
          {formatDateSlashMd(registrationCreatedAt)}
        </td>
        <td
          data-participant-label="이름"
          className="participant-col participant-col--name"
          style={{
            ...cellBase,
            textAlign: "left",
            verticalAlign: "top",
            wordBreak: "keep-all",
            whiteSpace: "normal",
            overflow: "visible",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: "0.2rem",
              minWidth: 0,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="client-tournament-manage__participantNameBtn"
              onClick={() => setDetailOpen(true)}
            >
              {applicantName}
            </button>
            {registrationSource === "admin" ? (
              <span
                style={{
                  fontSize: "0.52rem",
                  fontWeight: 700,
                  padding: "0.02rem 0.18rem",
                  borderRadius: "0.18rem",
                  background: "#eef2ff",
                  color: "#3730a3",
                  border: "1px solid #c7d2fe",
                  flexShrink: 0,
                }}
              >
                관리
              </span>
            ) : null}
          </div>
        </td>
        <td
          data-participant-label={metricColumnTitle}
          style={{ ...cellBase, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
        >
          {metricDisplay}
        </td>
        <td
          data-participant-label="입금자 이름"
          className="participant-col participant-col--depositor"
          style={{
            ...cellBase,
            textAlign: "left",
            verticalAlign: "top",
            wordBreak: "keep-all",
            whiteSpace: "normal",
            overflow: "visible",
          }}
        >
          {depositorDisplay}
        </td>
        <td data-participant-label="입금확인" style={{ ...cellBase }}>
          <div style={{ display: "flex", justifyContent: "center" }}>{depositButton()}</div>
        </td>
        <td data-participant-label={approveActionColumnLabel} style={{ ...cellBase }}>
          <div style={{ display: "flex", justifyContent: "center" }}>{approveButton()}</div>
        </td>
        <td data-participant-label="승인" style={{ ...cellBase, fontVariantNumeric: "tabular-nums" }}>
          {approveMd}
        </td>
        <td data-participant-label="취소/거절" style={{ ...cellBase }}>
          <div style={{ display: "flex", justifyContent: "center" }}>{cancelRejectButton()}</div>
        </td>
      </tr>
      {modalEl}
    </>
  );
}
