"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type PendingRegister = {
  applicantName: string;
  participantAverage: number;
  phone: string;
  adminNote: string;
};

export default function ParticipantAddSheet({
  tournamentId,
  maxParticipants,
  capacityOccupied,
  participantsFinalized,
  hasActiveBracket,
}: {
  tournamentId: string;
  maxParticipants: number;
  capacityOccupied: number;
  participantsFinalized: boolean;
  hasActiveBracket: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [participantAverage, setParticipantAverage] = useState("");
  const [phone, setPhone] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [finalizeWarnOpen, setFinalizeWarnOpen] = useState(false);
  const pendingAfterFinalizeRef = useRef<PendingRegister | null>(null);

  function close() {
    setOpen(false);
    setApplicantName("");
    setParticipantAverage("");
    setPhone("");
    setAdminNote("");
    setFinalizeWarnOpen(false);
    pendingAfterFinalizeRef.current = null;
  }

  async function performRegister(payload: PendingRegister) {
    setLoading(true);
    try {
      const response = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: payload.applicantName,
          participantAverage: payload.participantAverage,
          phone: payload.phone,
          adminNote: payload.adminNote,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        window.alert(result.error ?? "등록에 실패했습니다.");
        return;
      }
      close();
      router.refresh();
    } catch {
      window.alert("등록 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const name = applicantName.trim();
    if (!name) {
      window.alert("이름을 입력해 주세요.");
      return;
    }
    const avg = Number(String(participantAverage).trim().replace(",", "."));
    if (!Number.isFinite(avg)) {
      window.alert("에버를 숫자로 입력해 주세요.");
      return;
    }

    const maxP = Math.floor(Number(maxParticipants));
    const capOk =
      !Number.isFinite(maxP) ||
      maxP <= 0 ||
      capacityOccupied < maxP ||
      window.confirm(`모집정원(${maxP}명)을 초과합니다. 그래도 추가하시겠습니까?`);

    if (!capOk) return;

    const payload: PendingRegister = {
      applicantName: name,
      participantAverage: avg,
      phone: phone.trim(),
      adminNote: adminNote.trim(),
    };

    if (participantsFinalized) {
      pendingAfterFinalizeRef.current = payload;
      setFinalizeWarnOpen(true);
      return;
    }

    await performRegister(payload);
  }

  function onFinalizeWarnCancel() {
    setFinalizeWarnOpen(false);
    pendingAfterFinalizeRef.current = null;
  }

  function onFinalizeWarnConfirm() {
    const p = pendingAfterFinalizeRef.current;
    setFinalizeWarnOpen(false);
    pendingAfterFinalizeRef.current = null;
    if (!p) return;
    void performRegister(p);
  }

  return (
    <>
      <button
        type="button"
        className="v3-btn"
        onClick={() => setOpen(true)}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        수동 추가
      </button>
      {open ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
          onClick={close}
        >
          <form
            className="v3-stack client-dashboard-scroll-safe-area"
            onSubmit={handleSubmit}
            onClick={(ev) => ev.stopPropagation()}
            style={{
              background: "#fff",
              borderTopLeftRadius: "0.75rem",
              borderTopRightRadius: "0.75rem",
              paddingTop: "1rem",
              paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
              paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
              gap: "0.65rem",
              maxHeight: "88vh",
              overflowY: "auto",
              boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "1.05rem" }}>참가자 수동추가</strong>
              <button type="button" className="v3-btn" onClick={close} style={{ padding: "0.35rem 0.55rem" }}>
                닫기
              </button>
            </div>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              사이트 밖에서 신청한 참가자를 운영자가 대신 등록합니다. 즉시 참가자(관리자 등록)로 저장됩니다.
            </p>
            <label className="v3-stack" style={{ gap: "0.25rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>이름 (필수)</span>
              <input
                value={applicantName}
                onChange={(ev) => setApplicantName(ev.target.value)}
                autoComplete="name"
                inputMode="text"
                style={{
                  fontSize: "1rem",
                  minHeight: "2.75rem",
                  padding: "0.5rem 0.65rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.45rem",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label className="v3-stack" style={{ gap: "0.25rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>에버 (필수)</span>
              <input
                value={participantAverage}
                onChange={(ev) => setParticipantAverage(ev.target.value)}
                inputMode="decimal"
                autoComplete="off"
                style={{
                  fontSize: "1rem",
                  minHeight: "2.75rem",
                  padding: "0.5rem 0.65rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.45rem",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label className="v3-stack" style={{ gap: "0.25rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>전화번호 (선택)</span>
              <input
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                inputMode="tel"
                autoComplete="tel"
                style={{
                  fontSize: "1rem",
                  minHeight: "2.75rem",
                  padding: "0.5rem 0.65rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.45rem",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label className="v3-stack" style={{ gap: "0.25rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>비고 (선택)</span>
              <textarea
                value={adminNote}
                onChange={(ev) => setAdminNote(ev.target.value)}
                rows={2}
                style={{
                  fontSize: "0.95rem",
                  resize: "vertical",
                  minHeight: "4rem",
                  padding: "0.5rem 0.65rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0.45rem",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <button
              type="submit"
              className="v3-btn"
              disabled={loading}
              style={{
                marginTop: "0.25rem",
                padding: "0.75rem 1rem",
                fontWeight: 800,
                fontSize: "1rem",
                background: "#0f172a",
                color: "#fff",
                borderColor: "#0f172a",
              }}
            >
              {loading ? "저장 중…" : "저장"}
            </button>
          </form>
        </div>
      ) : null}

      {finalizeWarnOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 230,
            background: "rgba(15,23,42,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding:
              "max(1rem, env(safe-area-inset-top, 0px)) max(1rem, env(safe-area-inset-right, 0px)) max(1rem, env(safe-area-inset-bottom, 0px)) max(1rem, env(safe-area-inset-left, 0px))",
            boxSizing: "border-box",
          }}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) onFinalizeWarnCancel();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="참가 확정 후 추가 확인"
            className="v3-box v3-stack"
            style={{
              maxWidth: "22rem",
              width: "100%",
              background: "#fff",
              borderRadius: "0.65rem",
              padding: "1rem",
              gap: "0.55rem",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p style={{ margin: 0, fontWeight: 800, lineHeight: 1.45 }}>
              이미 참가자가 확정된 상태입니다. 추가하시겠습니까?
            </p>
            {hasActiveBracket ? (
              <>
                <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.45, fontWeight: 600 }}>
                  대진표를 다시 셔플해야 할 수 있습니다.
                </p>
                <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.45 }}>
                  필요 시 대진표를 다시 셔플하세요.
                </p>
              </>
            ) : null}
            <div className="v3-row" style={{ justifyContent: "flex-end", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              <button type="button" className="v3-btn" disabled={loading} onClick={() => onFinalizeWarnCancel()}>
                취소
              </button>
              <button type="button" className="v3-btn" disabled={loading} style={{ fontWeight: 800 }} onClick={() => onFinalizeWarnConfirm()}>
                추가
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
