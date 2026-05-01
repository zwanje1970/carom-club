"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ParticipantAddSheet({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [participantAverage, setParticipantAverage] = useState("");
  const [phone, setPhone] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(false);

  function close() {
    setOpen(false);
    setApplicantName("");
    setParticipantAverage("");
    setPhone("");
    setAdminNote("");
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
    setLoading(true);
    try {
      const response = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/participants/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: name,
          participantAverage: avg,
          phone: phone.trim(),
          adminNote: adminNote.trim(),
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

  return (
    <>
      <button
        type="button"
        className="v3-btn"
        onClick={() => setOpen(true)}
        style={{ padding: "0.55rem 0.85rem", fontWeight: 700, fontSize: "0.92rem", WebkitTapHighlightColor: "transparent" }}
      >
        참가자 추가
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
            className="v3-stack"
            onSubmit={handleSubmit}
            onClick={(ev) => ev.stopPropagation()}
            style={{
              background: "#fff",
              borderTopLeftRadius: "0.75rem",
              borderTopRightRadius: "0.75rem",
              padding: "1rem max(1rem, env(safe-area-inset-right)) calc(1rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))",
              gap: "0.65rem",
              maxHeight: "88vh",
              overflowY: "auto",
              boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "1.05rem" }}>참가자 추가</strong>
              <button type="button" className="v3-btn" onClick={close} style={{ padding: "0.35rem 0.55rem" }}>
                닫기
              </button>
            </div>
            <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              현장 입력 · 즉시 승인 · 관리자 등록으로 저장됩니다.
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
    </>
  );
}
