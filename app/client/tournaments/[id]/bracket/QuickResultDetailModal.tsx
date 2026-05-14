"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** 서버 `buildQuickResultDetailComputed`와 동일한 이닝·AVG 계산(미리보기용) */
function computeInningsAndAvgs(params: {
  firstAttackUserId: string;
  player1UserId: string;
  player2UserId: string;
  winnerUserId: string;
  scorePlayer1: number;
  scorePlayer2: number;
  endInning: number;
}): { inn1: number; inn2: number; avg1: number; avg2: number } | null {
  const p1 = params.player1UserId.trim();
  const p2 = params.player2UserId.trim();
  const first = params.firstAttackUserId.trim();
  const win = params.winnerUserId.trim();
  const E = params.endInning;
  if (!Number.isFinite(E) || E < 1) return null;
  let inn1: number;
  let inn2: number;
  if (first === p1) {
    if (win === p1) {
      inn1 = E;
      inn2 = Math.max(1, E - 1);
    } else {
      inn1 = E;
      inn2 = E;
    }
  } else if (first === p2) {
    if (win === p2) {
      inn2 = E;
      inn1 = Math.max(1, E - 1);
    } else {
      inn1 = E;
      inn2 = E;
    }
  } else {
    inn1 = Math.max(1, E);
    inn2 = Math.max(1, E);
  }
  const avg1 = Math.round((params.scorePlayer1 / inn1) * 1000) / 1000;
  const avg2 = Math.round((params.scorePlayer2 / inn2) * 1000) / 1000;
  return { inn1, inn2, avg1, avg2 };
}

function formatAvg3(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}

export type QuickResultDetailModalMatch = {
  id: string;
  player1: { userId: string; name: string; displayName?: string | null };
  player2: { userId: string; name: string; displayName?: string | null };
  winnerUserId: string | null;
  status: "PENDING" | "COMPLETED";
  quickResultDetail?: {
    firstAttackUserId: string;
    scorePlayer1: number;
    scorePlayer2: number;
    endInning: number;
    highRunPlayer1: number | null;
    highRunPlayer2: number | null;
    recordedAt: string;
  } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  match: QuickResultDetailModalMatch | null;
  tournamentId: string;
  bracketZoneQuery: string;
  p1Label: string;
  p2Label: string;
  onSaved: (bracket: unknown) => void;
  disabled?: boolean;
};

export default function QuickResultDetailModal({
  open,
  onClose,
  match,
  tournamentId,
  bracketZoneQuery,
  p1Label,
  p2Label,
  onSaved,
  disabled = false,
}: Props) {
  const [firstAttackUserId, setFirstAttackUserId] = useState("");
  const [scorePlayer1, setScorePlayer1] = useState("");
  const [scorePlayer2, setScorePlayer2] = useState("");
  const [endInning, setEndInning] = useState("");
  const [highExpanded, setHighExpanded] = useState(false);
  const [highRunPlayer1, setHighRunPlayer1] = useState("");
  const [highRunPlayer2, setHighRunPlayer2] = useState("");
  const [formError, setFormError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!open || !match) return;
    const d = match.quickResultDetail;
    setFirstAttackUserId(d?.firstAttackUserId?.trim() ?? "");
    setScorePlayer1(d != null ? String(d.scorePlayer1) : "");
    setScorePlayer2(d != null ? String(d.scorePlayer2) : "");
    setEndInning(d != null ? String(d.endInning) : "");
    const hasHr = d != null && (d.highRunPlayer1 != null || d.highRunPlayer2 != null);
    setHighExpanded(hasHr);
    setHighRunPlayer1(d?.highRunPlayer1 != null && d.highRunPlayer1 !== undefined ? String(d.highRunPlayer1) : "");
    setHighRunPlayer2(d?.highRunPlayer2 != null && d.highRunPlayer2 !== undefined ? String(d.highRunPlayer2) : "");
    setFormError("");
  }, [open, match]);

  const preview = useMemo(() => {
    if (!match) return null;
    const win = (match.winnerUserId ?? "").trim();
    if (!win || match.status !== "COMPLETED") return null;
    const s1 = Math.floor(Number(scorePlayer1));
    const s2 = Math.floor(Number(scorePlayer2));
    const E = Math.floor(Number(endInning));
    const fa = firstAttackUserId.trim();
    if (!fa || !Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0 || !Number.isFinite(E) || E < 1) {
      return null;
    }
    return computeInningsAndAvgs({
      firstAttackUserId: fa,
      player1UserId: match.player1.userId,
      player2UserId: match.player2.userId,
      winnerUserId: win,
      scorePlayer1: s1,
      scorePlayer2: s2,
      endInning: E,
    });
  }, [endInning, firstAttackUserId, match, scorePlayer1, scorePlayer2]);

  const parseOptionalInt = (raw: string): number | null | "bad" => {
    const t = raw.trim();
    if (t === "") return null;
    const n = Math.floor(Number(t));
    if (!Number.isFinite(n) || n < 0) return "bad";
    return n;
  };

  const handleSave = useCallback(async () => {
    if (!match || !tournamentId.trim()) return;
    const win = (match.winnerUserId ?? "").trim();
    if (!win || match.status !== "COMPLETED") {
      window.alert("먼저 승패를 선택해 주세요.");
      return;
    }
    const fa = firstAttackUserId.trim();
    if (!fa) {
      setFormError("선공을 선택해 주세요.");
      return;
    }
    const s1 = Math.floor(Number(scorePlayer1));
    const s2 = Math.floor(Number(scorePlayer2));
    const E = Math.floor(Number(endInning));
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0) {
      setFormError("점수를 확인해 주세요.");
      return;
    }
    if (!Number.isFinite(E) || E < 1) {
      setFormError("종료이닝을 확인해 주세요.");
      return;
    }
    let hr1: number | null = null;
    let hr2: number | null = null;
    if (highExpanded) {
      const a = parseOptionalInt(highRunPlayer1);
      const b = parseOptionalInt(highRunPlayer2);
      if (a === "bad" || b === "bad") {
        setFormError("하이런 값이 올바르지 않습니다. 비워 두면 미입력으로 저장됩니다.");
        return;
      }
      hr1 = a;
      hr2 = b;
    }
    setFormError("");
    setSaveBusy(true);
    try {
      const res = await fetch(
        `/api/client/tournaments/${encodeURIComponent(tournamentId)}/bracket/matches/${encodeURIComponent(match.id)}/quick-result-detail${bracketZoneQuery}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            firstAttackUserId: fa,
            scorePlayer1: s1,
            scorePlayer2: s2,
            endInning: E,
            highRunPlayer1: hr1,
            highRunPlayer2: hr2,
          }),
        },
      );
      const json = (await res.json()) as { bracket?: unknown; error?: string };
      if (!res.ok || !json.bracket) {
        setFormError(json.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved(json.bracket);
      onClose();
    } catch {
      setFormError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaveBusy(false);
    }
  }, [
    bracketZoneQuery,
    endInning,
    firstAttackUserId,
    highExpanded,
    highRunPlayer1,
    highRunPlayer2,
    match,
    onClose,
    onSaved,
    scorePlayer1,
    scorePlayer2,
    tournamentId,
  ]);

  if (!open || !match) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 401,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, var(--client-bottom-space, 80px)) max(16px, env(safe-area-inset-left))",
        boxSizing: "border-box",
      }}
      onClick={() => (!saveBusy && !disabled ? onClose() : null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "24rem",
          background: "#fff",
          borderRadius: "12px",
          padding: "1.05rem",
          border: "1px solid #cbd5e1",
          boxShadow: "none",
          boxSizing: "border-box",
          maxHeight: "min(90vh, 32rem)",
          overflowY: "auto",
        }}
      >
        <h2 id="qr-detail-title" style={{ margin: "0 0 0.55rem", fontSize: "1.02rem", fontWeight: 800 }}>
          상세 입력
        </h2>
        <p className="v3-muted" style={{ margin: "0 0 0.65rem", fontSize: "0.82rem", lineHeight: 1.45 }}>
          승패는 이 화면의 승·패 버튼으로만 반영됩니다. 여기서는 기록만 저장합니다.
        </p>

        <div className="v3-stack" style={{ gap: "0.55rem" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: "0.28rem" }}>선공</div>
            <div className="v3-row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.88rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name={`qr-first-${match.id}`}
                  checked={firstAttackUserId === match.player1.userId}
                  onChange={() => setFirstAttackUserId(match.player1.userId)}
                  disabled={disabled || saveBusy}
                />
                <span>
                  A ({p1Label}) <span style={{ fontWeight: 800 }}>○선</span>
                </span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.88rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name={`qr-first-${match.id}`}
                  checked={firstAttackUserId === match.player2.userId}
                  onChange={() => setFirstAttackUserId(match.player2.userId)}
                  disabled={disabled || saveBusy}
                />
                <span>
                  B ({p2Label}) <span style={{ fontWeight: 800 }}>○선</span>
                </span>
              </label>
            </div>
          </div>

          <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 8rem", display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.82rem", fontWeight: 700 }}>
              A 점수
              <input
                className="v3-btn"
                inputMode="numeric"
                value={scorePlayer1}
                onChange={(e) => setScorePlayer1(e.target.value)}
                disabled={disabled || saveBusy}
                style={{ fontWeight: 600, minHeight: 40 }}
              />
            </label>
            <label style={{ flex: "1 1 8rem", display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.82rem", fontWeight: 700 }}>
              B 점수
              <input
                className="v3-btn"
                inputMode="numeric"
                value={scorePlayer2}
                onChange={(e) => setScorePlayer2(e.target.value)}
                disabled={disabled || saveBusy}
                style={{ fontWeight: 600, minHeight: 40 }}
              />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.82rem", fontWeight: 700 }}>
            종료 이닝
            <input
              className="v3-btn"
              inputMode="numeric"
              value={endInning}
              onChange={(e) => setEndInning(e.target.value)}
              disabled={disabled || saveBusy}
              style={{ fontWeight: 600, minHeight: 40, maxWidth: "10rem" }}
            />
          </label>

          {preview ? (
            <div
              style={{
                fontSize: "0.82rem",
                lineHeight: 1.5,
                color: "#334155",
                background: "#f1f5f9",
                borderRadius: 8,
                padding: "0.45rem 0.55rem",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: "0.25rem" }}>계산 미리보기</div>
              <div>
                A 이닝 {preview.inn1} · A AVG {formatAvg3(preview.avg1)}
              </div>
              <div>
                B 이닝 {preview.inn2} · B AVG {formatAvg3(preview.avg2)}
              </div>
            </div>
          ) : null}

          <div>
            <button
              type="button"
              className="v3-btn"
              onClick={() => setHighExpanded((v) => !v)}
              disabled={disabled || saveBusy}
              style={{ fontSize: "0.84rem", fontWeight: 700, padding: "0.35rem 0.55rem" }}
            >
              {highExpanded ? "하이런 접기" : "하이런 입력"}
            </button>
            {highExpanded ? (
              <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap", marginTop: "0.45rem" }}>
                <label style={{ flex: "1 1 8rem", display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.82rem", fontWeight: 700 }}>
                  A 하이런 (선택)
                  <input
                    className="v3-btn"
                    inputMode="numeric"
                    value={highRunPlayer1}
                    onChange={(e) => setHighRunPlayer1(e.target.value)}
                    disabled={disabled || saveBusy}
                    style={{ fontWeight: 600, minHeight: 40 }}
                    placeholder="비움"
                  />
                </label>
                <label style={{ flex: "1 1 8rem", display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.82rem", fontWeight: 700 }}>
                  B 하이런 (선택)
                  <input
                    className="v3-btn"
                    inputMode="numeric"
                    value={highRunPlayer2}
                    onChange={(e) => setHighRunPlayer2(e.target.value)}
                    disabled={disabled || saveBusy}
                    style={{ fontWeight: 600, minHeight: 40 }}
                    placeholder="비움"
                  />
                </label>
              </div>
            ) : null}
          </div>

          {formError ? (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.84rem", fontWeight: 600 }}>{formError}</p>
          ) : null}

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap", marginTop: "0.25rem" }}>
            <button type="button" className="v3-btn" disabled={saveBusy || disabled} onClick={onClose} style={{ minHeight: 44 }}>
              닫기
            </button>
            <button
              type="button"
              className="ui-btn-primary-solid"
              disabled={saveBusy || disabled}
              onClick={() => void handleSave()}
              style={{ minHeight: 44, fontWeight: 700 }}
            >
              {saveBusy ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
