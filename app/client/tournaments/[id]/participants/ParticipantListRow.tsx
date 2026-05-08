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

function applicationStatusShortKo(status: TournamentApplicationStatus): string {
  switch (status) {
    case "APPLIED":
      return "신청";
    case "VERIFYING":
      return "확인중";
    case "WAITING_PAYMENT":
      return "입금대기";
    case "APPROVED":
      return "확정";
    case "REJECTED":
      return "거절";
    default:
      return status;
  }
}

/** 신청일·승인일 — 월/일만 (예: 12/25) */
function formatDateSlashMd(iso: string | null | undefined): string {
  const raw = (iso ?? "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const cellBase: CSSProperties = {
  padding: "0.22rem 0.36rem",
  fontSize: "0.72rem",
  verticalAlign: "middle",
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
  adminNote,
  statusChangedAt,
  initialClientDepositConfirmedAt,
  initialClientApplicationApprovedAt,
  attendanceChecked,
  rowLayout = "standard",
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
  adminNote?: string | null;
  statusChangedAt?: string;
  initialClientDepositConfirmedAt?: string | null;
  initialClientApplicationApprovedAt?: string | null;
  attendanceChecked?: boolean | null;
  rowLayout?: "standard" | "fullscreen";
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

  /** ₩ 입금확인 — 빨강 계열, 미완 ○ / 완료 ● */
  function renderWonBtn() {
    const done = terminalApproved || depositDone;
    const idleCls = done ? "participant-op-btn participant-op-btn--won participant-op-btn--won-done" : "participant-op-btn participant-op-btn--won participant-op-btn--won-idle";
    if (terminalApproved) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className={`${idleCls} participant-op-btn--disabled`} aria-label="입금확인(완료)">
            ₩
          </button>
        </span>
      );
    }
    if (terminalRejected) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--won participant-op-btn--won-muted" aria-label="입금확인(불가)">
            ₩
          </button>
        </span>
      );
    }
    return (
      <span className="participant-op-hit">
        <button
          type="button"
          disabled={loading || depositConfirmSaving}
          className={idleCls}
          aria-label={done ? "입금확인(완료)" : "입금확인"}
          onClick={() => onDepositClick()}
        >
          ₩
        </button>
      </span>
    );
  }

  /** ✓ 승인 — 초록 계열 */
  function renderCheckBtn() {
    if (terminalApproved) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--check participant-op-btn--check-done participant-op-btn--disabled" aria-label="승인(완료)">
            ✓
          </button>
        </span>
      );
    }
    if (terminalRejected) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--check participant-op-btn--check-muted" aria-label="승인(불가)">
            ✓
          </button>
        </span>
      );
    }
    if (!depositDone) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--check participant-op-btn--check-wait" aria-label="승인(입금확인 필요)">
            ✓
          </button>
        </span>
      );
    }
    const done = approveDone;
    const cls = done ? "participant-op-btn participant-op-btn--check participant-op-btn--check-done" : "participant-op-btn participant-op-btn--check participant-op-btn--check-idle";
    return (
      <span className="participant-op-hit">
        <button type="button" disabled={loading} className={cls} aria-label={done ? "승인(완료)" : "승인"} onClick={() => onApproveClick()}>
          ✓
        </button>
      </span>
    );
  }

  /** ✕ 취소/거절 — 회색 계열 */
  function renderCrossBtn() {
    if (terminalApproved) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--cross participant-op-btn--cross-muted participant-op-btn--disabled" aria-label="취소/거절(불가)">
            <span className="participant-op-cross-glyph" aria-hidden="true">
              ✕
            </span>
          </button>
        </span>
      );
    }
    if (terminalRejected) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--cross participant-op-btn--cross-done participant-op-btn--disabled" aria-label="취소/거절(완료)">
            <span className="participant-op-cross-glyph" aria-hidden="true">
              ✕
            </span>
          </button>
        </span>
      );
    }
    return (
      <span className="participant-op-hit">
        <button type="button" disabled={loading} className="participant-op-btn participant-op-btn--cross participant-op-btn--cross-idle" aria-label="취소/거절" onClick={() => onCancelRejectClick()}>
          <span className="participant-op-cross-glyph" aria-hidden="true">
            ✕
          </span>
        </button>
      </span>
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

  const approveInfoCell =
    terminalRejected ? "—" : approveDone ? approveMd : applicationStatusShortKo(status);

  const phoneDisplay = (phone ?? "").trim() || "—";

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

  const opsCell = (
    <td className="participant-col participant-col--ops" style={{ ...cellBase, textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      <div className="participant-op-inline">{renderWonBtn()}</div>
    </td>
  );
  const opsCellCheck = (
    <td className="participant-col participant-col--ops" style={{ ...cellBase, textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      <div className="participant-op-inline">{renderCheckBtn()}</div>
    </td>
  );
  const opsCellCross = (
    <td className="participant-col participant-col--ops" style={{ ...cellBase, textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      <div className="participant-op-inline">{renderCrossBtn()}</div>
    </td>
  );

  const ellipsisTd = (label: string, content: string, align: "left" | "center" = "left", extraClass = "") => (
    <td
      data-participant-label={label}
      className={`participant-col participant-col--ellipsis ${extraClass}`.trim()}
      style={{
        ...cellBase,
        textAlign: align,
        maxWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
      title={content}
    >
      {content}
    </td>
  );

  return (
    <>
      <tr className={terminalRejected ? "participant-row--rejected" : undefined} style={{ background: rowBg }}>
        <td data-participant-label="신청" style={{ ...cellBase, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {formatDateSlashMd(registrationCreatedAt)}
        </td>
        <td data-participant-label="이름" className="participant-col participant-col--name" style={{ ...cellBase, textAlign: "left", maxWidth: 0 }}>
          <div className="participant-name-cell-1l">
            <button type="button" className="client-tournament-manage__participantNameBtn participant-name-btn-ellipsis" onClick={() => setDetailOpen(true)}>
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
        {rowLayout === "fullscreen" ? (
          <td
            data-participant-label="전화번호"
            className="participant-col participant-col--phoneFs"
            style={{ ...cellBase, textAlign: "left", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: "#334155" }}
            title={phoneDisplay}
          >
            {phoneDisplay}
          </td>
        ) : null}
        <td
          data-participant-label={metricColumnTitle}
          className="participant-col participant-col--metric"
          style={{ ...cellBase, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
        >
          {metricDisplay}
        </td>
        {rowLayout === "fullscreen"
          ? ellipsisTd("소속", affiliationDisplay, "left", "participant-col--affiliationFs")
          : null}
        {ellipsisTd("입금자", depositorDisplay, "left", "participant-col--depositor")}
        <td
          data-participant-label="승인"
          style={{
            ...cellBase,
            maxWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            color: "#334155",
          }}
          title={approveInfoCell}
        >
          {approveInfoCell}
        </td>
        {opsCell}
        {opsCellCheck}
        {opsCellCross}
      </tr>
      {modalEl}
    </>
  );
}
