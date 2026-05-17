"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import ParticipantApplicationDetailModal from "./ParticipantApplicationDetailModal";
import ParticipantProcessingConfirmModal, {
  type ParticipantProcessingConfirmKind,
} from "./ParticipantProcessingConfirmModal";

type TournamentApplicationStatus =
  | "APPLIED"
  | "VERIFYING"
  | "WAITING_PAYMENT"
  | "WAITING"
  | "APPROVED"
  | "REJECTED";

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
  handicap,
  metricColumnTitle,
  adminNote,
  statusChangedAt,
  initialClientDepositConfirmedAt,
  initialClientApplicationApprovedAt,
  initialClientApplicationCancelledAt,
  attendanceChecked,
  rowLayout = "standard",
  opButtonPresentation = "icon",
  approvalCapacityFull = false,
  onProcessingUpdated,
  onDeleted,
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
  handicap?: number | null;
  metricColumnTitle: string;
  adminNote?: string | null;
  statusChangedAt?: string;
  initialClientDepositConfirmedAt?: string | null;
  initialClientApplicationApprovedAt?: string | null;
  initialClientApplicationCancelledAt?: string | null;
  attendanceChecked?: boolean | null;
  rowLayout?: "standard" | "fullscreen";
  opButtonPresentation?: "icon" | "text";
  /** 모집인원 승인 정원 충족 — 신규 승인 불가 */
  approvalCapacityFull?: boolean;
  onProcessingUpdated?: (patch: {
    clientDepositConfirmedAt?: string | null;
    clientApplicationApprovedAt?: string | null;
    clientApplicationCancelledAt?: string | null;
  }) => void;
  onDeleted?: (entryId: string) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TournamentApplicationStatus>(initialStatus);
  const [clientDepositConfirmedAt, setClientDepositConfirmedAt] = useState<string | null>(
    initialClientDepositConfirmedAt ?? null,
  );
  const [clientApplicationApprovedAt, setClientApplicationApprovedAt] = useState<string | null>(
    initialClientApplicationApprovedAt ?? null,
  );
  const [clientApplicationCancelledAt, setClientApplicationCancelledAt] = useState<string | null>(
    initialClientApplicationCancelledAt ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [depositConfirmSaving, setDepositConfirmSaving] = useState(false);
  const depositConfirmInflightRef = useRef<Promise<void> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ParticipantProcessingConfirmKind | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setClientDepositConfirmedAt(initialClientDepositConfirmedAt ?? null);
  }, [initialClientDepositConfirmedAt]);

  useEffect(() => {
    setClientApplicationApprovedAt(initialClientApplicationApprovedAt ?? null);
  }, [initialClientApplicationApprovedAt]);

  useEffect(() => {
    setClientApplicationCancelledAt(initialClientApplicationCancelledAt ?? null);
  }, [initialClientApplicationCancelledAt]);

  const terminalRejected = status === "REJECTED";
  const terminalApproved = status === "APPROVED";
  const terminalWaiting = status === "WAITING";
  const processingCancelled =
    typeof clientApplicationCancelledAt === "string" && clientApplicationCancelledAt.trim() !== "";

  const depositDone =
    terminalApproved ||
    (typeof clientDepositConfirmedAt === "string" && clientDepositConfirmedAt.trim() !== "");
  const approveDone =
    terminalApproved ||
    (typeof clientApplicationApprovedAt === "string" && clientApplicationApprovedAt.trim() !== "");
  const showDeleteButton = rowLayout === "fullscreen";
  const deleteAllowed =
    showDeleteButton &&
    !terminalRejected &&
    !terminalApproved &&
    !terminalWaiting &&
    !depositDone &&
    !approveDone &&
    !processingCancelled;

  async function patchProcessing(
    patch: {
      depositConfirmed?: boolean;
      applicationApproved?: boolean;
      applicationCancelled?: boolean;
    },
    options?: { fromConfirmModal?: boolean },
  ): Promise<boolean> {
    if (loading && !options?.fromConfirmModal) return false;
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
          clientApplicationCancelledAt?: string | null;
        };
      };
      if (!response.ok) {
        window.alert(result.error ?? "저장에 실패했습니다.");
        return false;
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
      const nextDeposit =
        app && "clientDepositConfirmedAt" in app
          ? typeof app.clientDepositConfirmedAt === "string" && app.clientDepositConfirmedAt.trim()
            ? app.clientDepositConfirmedAt.trim()
            : null
          : undefined;
      const nextApprove =
        app && "clientApplicationApprovedAt" in app
          ? typeof app.clientApplicationApprovedAt === "string" && app.clientApplicationApprovedAt.trim()
            ? app.clientApplicationApprovedAt.trim()
            : null
          : undefined;
      const nextCancelled =
        app && "clientApplicationCancelledAt" in app
          ? typeof app.clientApplicationCancelledAt === "string" && app.clientApplicationCancelledAt.trim()
            ? app.clientApplicationCancelledAt.trim()
            : null
          : undefined;
      if (app && "clientApplicationCancelledAt" in app) {
        setClientApplicationCancelledAt(nextCancelled ?? null);
      }
      onProcessingUpdated?.({
        ...(nextDeposit !== undefined ? { clientDepositConfirmedAt: nextDeposit } : {}),
        ...(nextApprove !== undefined ? { clientApplicationApprovedAt: nextApprove } : {}),
        ...(nextCancelled !== undefined ? { clientApplicationCancelledAt: nextCancelled } : {}),
      });
      router.refresh();
      return true;
    } catch {
      window.alert("처리 중 오류가 발생했습니다.");
      return false;
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
    if (terminalRejected || terminalApproved || terminalWaiting || processingCancelled) return;
    if (!depositDone) {
      runDepositConfirmOptimistic();
      return;
    }
    setConfirmKind("deposit-unconfirm");
  }

  function onApproveClick() {
    if (terminalRejected || terminalApproved || terminalWaiting || processingCancelled) return;
    if (!depositDone) return;
    if (!approveDone) {
      if (approvalCapacityFull) {
        window.alert("모집인원이 가득 찼습니다.\n기존 승인자를 취소 후 추가해주세요.");
        return;
      }
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
    setConfirmKind("approval-unconfirm");
  }

  function onCancelClick() {
    if (terminalRejected || terminalApproved || terminalWaiting || loading) return;
    setConfirmKind(processingCancelled ? "cancel-off" : "cancel-on");
  }

  function onDeleteClick() {
    if (!showDeleteButton || terminalRejected || terminalApproved || terminalWaiting || deleteBusy) return;
    if (!deleteAllowed) {
      window.alert("삭제하려면 먼저 입금확인, 승인, 취소를 모두 해제하세요.");
      return;
    }
    setConfirmKind("delete");
  }

  async function handleConfirmModalAction() {
    if (!confirmKind || confirmBusy || deleteBusy) return;
    if (confirmKind === "delete") {
      setConfirmBusy(true);
      setDeleteBusy(true);
      try {
        const response = await fetch(
          `/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/${encodeURIComponent(entryId)}`,
          { method: "DELETE", credentials: "same-origin" },
        );
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          window.alert(result.error ?? "삭제에 실패했습니다.");
          return;
        }
        setConfirmKind(null);
        onDeleted?.(entryId);
      } catch {
        window.alert("삭제 중 오류가 발생했습니다.");
      } finally {
        setConfirmBusy(false);
        setDeleteBusy(false);
      }
      return;
    }

    setConfirmBusy(true);
    try {
      let ok = false;
      if (confirmKind === "deposit-unconfirm") {
        ok = await patchProcessing({ depositConfirmed: false }, { fromConfirmModal: true });
      } else if (confirmKind === "approval-unconfirm") {
        ok = await patchProcessing({ applicationApproved: false }, { fromConfirmModal: true });
      } else if (confirmKind === "cancel-on") {
        ok = await patchProcessing({ applicationCancelled: true }, { fromConfirmModal: true });
      } else if (confirmKind === "cancel-off") {
        ok = await patchProcessing({ applicationCancelled: false }, { fromConfirmModal: true });
      }
      if (ok) setConfirmKind(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const textOpBtnBase: CSSProperties = {
    minHeight: 31,
    minWidth: "3.2rem",
    padding: "0.14rem 0.28rem",
    fontSize: "0.68rem",
    fontWeight: 700,
    borderRadius: "0.22rem",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#334155",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "manipulation",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };

  /** ₩ 입금확인 — 빨강 계열, 미완 ○ / 완료 ● */
  function renderWonBtn() {
    if (opButtonPresentation === "text") {
      if (terminalWaiting || terminalRejected || processingCancelled) {
        return (
          <button type="button" disabled className="participant-op-textBtn" style={{ ...textOpBtnBase, opacity: 0.55 }}>
            입금확인
          </button>
        );
      }
      if (terminalApproved) {
        return (
          <button type="button" disabled className="participant-op-textBtn" style={{ ...textOpBtnBase, opacity: 0.55 }}>
            입금확인
          </button>
        );
      }
      const done = depositDone;
      return (
        <button
          type="button"
          className="participant-op-textBtn"
          disabled={loading || depositConfirmSaving}
          style={{
            ...textOpBtnBase,
            borderColor: done ? "#dc2626" : "#f87171",
            color: done ? "#fff" : "#b91c1c",
            background: done ? "#dc2626" : "#fff",
          }}
          onClick={() => onDepositClick()}
        >
          입금확인
        </button>
      );
    }
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
    if (terminalWaiting) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--won participant-op-btn--won-muted" aria-label="입금확인(대기자)">
            ₩
          </button>
        </span>
      );
    }
    if (processingCancelled) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--won participant-op-btn--won-muted" aria-label="입금확인(취소됨)">
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
    if (opButtonPresentation === "text") {
      if (terminalWaiting || terminalRejected || processingCancelled) {
        return (
          <button type="button" disabled className="participant-op-textBtn" style={{ ...textOpBtnBase, opacity: 0.55 }}>
            승인
          </button>
        );
      }
      if (terminalApproved) {
        return (
          <button type="button" disabled className="participant-op-textBtn" style={{ ...textOpBtnBase, opacity: 0.55 }}>
            승인
          </button>
        );
      }
      if (!depositDone || (approvalCapacityFull && !approveDone)) {
        return (
          <button type="button" disabled className="participant-op-textBtn" style={{ ...textOpBtnBase, opacity: 0.55 }}>
            승인
          </button>
        );
      }
      const done = approveDone;
      return (
        <button
          type="button"
          className="participant-op-textBtn"
          disabled={loading}
          style={{
            ...textOpBtnBase,
            borderColor: done ? "#15803d" : "#86efac",
            color: done ? "#fff" : "#166534",
            background: done ? "#15803d" : "#fff",
          }}
          onClick={() => onApproveClick()}
        >
          승인
        </button>
      );
    }
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
    if (terminalWaiting) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--check participant-op-btn--check-muted" aria-label="승인(대기자)">
            ✓
          </button>
        </span>
      );
    }
    if (processingCancelled) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--check participant-op-btn--check-muted" aria-label="승인(취소됨)">
            ✓
          </button>
        </span>
      );
    }
    if (!depositDone || (approvalCapacityFull && !approveDone)) {
      return (
        <span className="participant-op-hit">
          <button
            type="button"
            disabled
            className="participant-op-btn participant-op-btn--check participant-op-btn--check-wait"
            aria-label={!depositDone ? "승인(입금확인 필요)" : "승인(정원 초과)"}
          >
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

  /** ✕ 취소 — 회색 계열, 토글 */
  function renderCrossBtn() {
    if (opButtonPresentation === "text") {
      if (terminalApproved || terminalWaiting) {
        return (
          <button type="button" disabled className="participant-op-textBtn" style={{ ...textOpBtnBase, opacity: 0.55 }}>
            취소
          </button>
        );
      }
      if (terminalRejected) {
        return (
          <button type="button" disabled className="participant-op-textBtn" style={{ ...textOpBtnBase, opacity: 0.55 }}>
            취소
          </button>
        );
      }
      const done = processingCancelled;
      return (
        <button
          type="button"
          className="participant-op-textBtn"
          disabled={loading}
          style={{
            ...textOpBtnBase,
            borderColor: done ? "#64748b" : "#cbd5e1",
            color: done ? "#fff" : "#334155",
            background: done ? "#64748b" : "#fff",
          }}
          onClick={() => onCancelClick()}
        >
          취소
        </button>
      );
    }
    if (terminalApproved || terminalWaiting) {
      return (
        <span className="participant-op-hit">
          <button type="button" disabled className="participant-op-btn participant-op-btn--cross participant-op-btn--cross-muted participant-op-btn--disabled" aria-label="취소(불가)">
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
          <button type="button" disabled className="participant-op-btn participant-op-btn--cross participant-op-btn--cross-done participant-op-btn--disabled" aria-label="취소(완료)">
            <span className="participant-op-cross-glyph" aria-hidden="true">
              ✕
            </span>
          </button>
        </span>
      );
    }
    const done = processingCancelled;
    const cls = done
      ? "participant-op-btn participant-op-btn--cross participant-op-btn--cross-done"
      : "participant-op-btn participant-op-btn--cross participant-op-btn--cross-idle";
    return (
      <span className="participant-op-hit">
        <button
          type="button"
          disabled={loading}
          className={cls}
          aria-label={done ? "취소(완료)" : "취소"}
          onClick={() => onCancelClick()}
        >
          <span className="participant-op-cross-glyph" aria-hidden="true">
            ✕
          </span>
        </button>
      </span>
    );
  }

  /** 휴지통 삭제 — 가로모드(fullscreen) 전용 */
  function renderDeleteBtn() {
    if (!showDeleteButton) return null;
    if (terminalApproved || terminalWaiting || terminalRejected) {
      return (
        <span className="participant-op-hit">
          <button
            type="button"
            disabled
            className="participant-op-btn participant-op-btn--delete participant-op-btn--delete-muted"
            aria-label="삭제(불가)"
          >
            <Trash2 size={11} strokeWidth={2.2} aria-hidden />
          </button>
        </span>
      );
    }
    const cls = deleteAllowed
      ? "participant-op-btn participant-op-btn--delete participant-op-btn--delete-idle"
      : "participant-op-btn participant-op-btn--delete participant-op-btn--delete-muted";
    return (
      <span className="participant-op-hit">
        <button
          type="button"
          disabled={loading || deleteBusy}
          className={cls}
          aria-label={deleteAllowed ? "삭제" : "삭제(해제 필요)"}
          onClick={() => onDeleteClick()}
        >
          <Trash2 size={11} strokeWidth={2.2} aria-hidden />
        </button>
      </span>
    );
  }

  const depositorDisplay = (typeof depositorName === "string" ? depositorName.trim() : "") || "—";
  const affiliationDisplay = (typeof affiliation === "string" ? affiliation.trim() : "") || "—";
  const metricDisplay =
    participantAverage != null && Number.isFinite(participantAverage) ? String(participantAverage) : "—";
  const handicapDisplay = handicap != null && Number.isFinite(handicap) ? String(handicap) : "—";

  const rowBg = terminalRejected || processingCancelled ? "#f3f4f6" : terminalWaiting ? "#fffbeb" : "#fff";

  const approveAtRaw = (clientApplicationApprovedAt ?? "").trim();
  const approveInfoCell =
    terminalRejected || processingCancelled ? "—" : approveAtRaw ? formatDateSlashMd(approveAtRaw) : "-";

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
            handicap={handicap}
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
  const opsCellDelete = showDeleteButton ? (
    <td className="participant-col participant-col--ops participant-col--delete" style={{ ...cellBase, textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      <div className="participant-op-inline">{renderDeleteBtn()}</div>
    </td>
  ) : null;

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
      <tr
        className={terminalRejected || processingCancelled ? "participant-row--rejected" : undefined}
        style={{ background: rowBg }}
      >
        <td
          data-participant-label="신청"
          className="participant-col participant-col--apply"
          style={{ ...cellBase, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
        >
          {formatDateSlashMd(registrationCreatedAt)}
        </td>
        <td data-participant-label="이름" className="participant-col participant-col--name" style={{ ...cellBase, textAlign: "left", maxWidth: 0 }}>
          <div className="participant-name-cell-1l">
            <button type="button" className="client-tournament-manage__participantNameBtn participant-name-btn-ellipsis" onClick={() => setDetailOpen(true)}>
              {applicantName}
            </button>
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
        {rowLayout === "fullscreen" ? (
          <td
            data-participant-label="핸디"
            className="participant-col participant-col--handicap"
            style={{ ...cellBase, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
          >
            {handicapDisplay}
          </td>
        ) : null}
        {rowLayout === "fullscreen" ? (
          <td
            data-participant-label={metricColumnTitle}
            className="participant-col participant-col--metric"
            style={{ ...cellBase, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
          >
            {metricDisplay}
          </td>
        ) : null}
        {rowLayout === "fullscreen"
          ? ellipsisTd("소속", affiliationDisplay, "left", "participant-col--affiliationFs")
          : null}
        {ellipsisTd("입금자", depositorDisplay, "left", "participant-col--depositor")}
        <td
          data-participant-label="승인"
          className={
            rowLayout === "fullscreen" ? "participant-col participant-col--approveInfoFs" : "participant-col participant-col--approveInfo"
          }
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
        {opsCellDelete}
      </tr>
      {modalEl}
      {confirmKind ? (
        <ParticipantProcessingConfirmModal
          kind={confirmKind}
          busy={confirmBusy || deleteBusy}
          onClose={() => {
            if (!confirmBusy && !deleteBusy) setConfirmKind(null);
          }}
          onConfirm={() => void handleConfirmModalAction()}
        />
      ) : null}
    </>
  );
}
