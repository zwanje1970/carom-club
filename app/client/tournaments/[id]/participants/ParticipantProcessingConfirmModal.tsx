"use client";

import { createPortal } from "react-dom";

export type ParticipantProcessingConfirmKind =
  | "deposit-unconfirm"
  | "approval-unconfirm"
  | "cancel-on"
  | "cancel-off"
  | "delete";

const COPY: Record<
  ParticipantProcessingConfirmKind,
  { title: string; body: string; confirmLabel: string; danger?: boolean }
> = {
  "deposit-unconfirm": {
    title: "입금확인 해제",
    body: "입금확인을 해제하시겠습니까?",
    confirmLabel: "해제",
  },
  "approval-unconfirm": {
    title: "승인 해제",
    body: "승인을 해제하시겠습니까?",
    confirmLabel: "해제",
  },
  "cancel-on": {
    title: "참가 취소 처리",
    body: "참가 신청을 취소 처리하시겠습니까?\n입금확인과 승인은 해제됩니다.",
    confirmLabel: "처리",
  },
  "cancel-off": {
    title: "취소 해제",
    body: "취소를 해제하고 이전 상태로 복구하시겠습니까?",
    confirmLabel: "복구",
  },
  delete: {
    title: "신청자 삭제",
    body: "삭제하면 복구할 수 없습니다.\n테스트 신청, 중복 신청, 잘못 등록된 경우만 삭제하세요.",
    confirmLabel: "삭제",
    danger: true,
  },
};

export default function ParticipantProcessingConfirmModal({
  kind,
  busy = false,
  onClose,
  onConfirm,
}: {
  kind: ParticipantProcessingConfirmKind;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") return null;

  const copy = COPY[kind];
  const bodyLines = copy.body.split("\n");

  return createPortal(
    <div
      className="client-tournament-manage participant-processing-confirm-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="participant-processing-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="participant-processing-confirm-title"
      >
        <h2 id="participant-processing-confirm-title" className="participant-processing-confirm-title">
          {copy.title}
        </h2>
        <div className="participant-processing-confirm-body">
          {bodyLines.map((line, i) => (
            <p key={i} className="participant-processing-confirm-bodyLine">
              {line}
            </p>
          ))}
        </div>
        <div className="participant-processing-confirm-actions">
          <button type="button" className="participant-processing-confirm-btn" disabled={busy} onClick={() => onClose()}>
            취소
          </button>
          <button
            type="button"
            className={
              copy.danger
                ? "participant-processing-confirm-btn participant-processing-confirm-btn--danger"
                : "participant-processing-confirm-btn participant-processing-confirm-btn--primary"
            }
            disabled={busy}
            onClick={() => onConfirm()}
          >
            {busy ? "처리 중…" : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
