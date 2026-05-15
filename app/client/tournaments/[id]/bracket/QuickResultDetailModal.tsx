"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FocusEvent } from "react";
import styles from "./QuickResultDetailModal.module.css";
import {
  clearQuickResultDetailDraft,
  readQuickResultDetailDraft,
  writeQuickResultDetailDraft,
} from "./quick-result-detail-draft";

/** AVG = 점수 ÷ 이닝, 소수 셋째 자리까지 버림 */
function truncateAvg3(score: number, innings: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(innings) || innings < 1) return 0;
  return Math.floor((score / innings) * 1000) / 1000;
}

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
  return {
    inn1,
    inn2,
    avg1: truncateAvg3(params.scorePlayer1, inn1),
    avg2: truncateAvg3(params.scorePlayer2, inn2),
  };
}

function formatAvg3(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}

function ResultPill({ label, variant }: { label: string; variant: "win" | "lose" }) {
  return (
    <span className={`${styles.pill} ${variant === "win" ? styles.pillWin : styles.pillLose}`}>{label}</span>
  );
}

function OptionalHighRunInput({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.replace(/[^\d]/g, ""));
  };
  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (!value) e.currentTarget.placeholder = "";
  };
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!e.currentTarget.value.trim()) {
      e.currentTarget.placeholder = "—";
    }
  };

  return (
    <input
      className={`${styles.cellInput} ${!value ? styles.cellInputPlaceholder : ""}`}
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="—"
      aria-label={ariaLabel}
    />
  );
}

function BreakIndicator({ kind }: { kind: "first" | "second" }) {
  return (
    <span className={styles.breakMark} title={kind === "first" ? "선구" : "후구"}>
      {kind === "first" ? (
        <>
          <span className={styles.breakWhite} aria-hidden />
          선구
        </>
      ) : (
        <>
          <span className={styles.breakYellow} aria-hidden />
          후구
        </>
      )}
    </span>
  );
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
  const [highRunPlayer1, setHighRunPlayer1] = useState("");
  const [highRunPlayer2, setHighRunPlayer2] = useState("");
  const [formError, setFormError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!open || !match) return;
    const d = match.quickResultDetail;
    const savedFirst = d?.firstAttackUserId?.trim() ?? "";
    const win = (match.winnerUserId ?? "").trim();
    const fromSaved = {
      firstAttackUserId: savedFirst || match.player1.userId,
      scorePlayer1: d != null ? String(d.scorePlayer1) : "",
      scorePlayer2: d != null ? String(d.scorePlayer2) : "",
      endInning: d != null ? String(d.endInning) : "",
      highRunPlayer1:
        d?.highRunPlayer1 != null && d.highRunPlayer1 !== undefined ? String(d.highRunPlayer1) : "",
      highRunPlayer2:
        d?.highRunPlayer2 != null && d.highRunPlayer2 !== undefined ? String(d.highRunPlayer2) : "",
    };
    const draft = tournamentId.trim() ? readQuickResultDetailDraft(tournamentId, match.id) : null;
    const useDraft = draft != null && draft.winnerUserId === win;
    setFirstAttackUserId(useDraft ? draft.firstAttackUserId || fromSaved.firstAttackUserId : fromSaved.firstAttackUserId);
    setScorePlayer1(useDraft ? draft.scorePlayer1 : fromSaved.scorePlayer1);
    setScorePlayer2(useDraft ? draft.scorePlayer2 : fromSaved.scorePlayer2);
    setEndInning(useDraft ? draft.endInning : fromSaved.endInning);
    setHighRunPlayer1(useDraft ? draft.highRunPlayer1 : fromSaved.highRunPlayer1);
    setHighRunPlayer2(useDraft ? draft.highRunPlayer2 : fromSaved.highRunPlayer2);
    setFormError("");
  }, [open, match, tournamentId]);

  const winnerUserId = (match?.winnerUserId ?? "").trim();
  const matchCompleted = match?.status === "COMPLETED" && winnerUserId !== "";
  const p1Win = matchCompleted && winnerUserId === match?.player1.userId;
  const p2Win = matchCompleted && winnerUserId === match?.player2.userId;

  const p1IsFirst = firstAttackUserId === match?.player1.userId;
  const p2IsFirst = firstAttackUserId === match?.player2.userId;

  useEffect(() => {
    if (!open || !match || !tournamentId.trim()) return;
    writeQuickResultDetailDraft(tournamentId, match.id, {
      firstAttackUserId,
      scorePlayer1,
      scorePlayer2,
      endInning,
      highRunPlayer1,
      highRunPlayer2,
      winnerUserId,
    });
  }, [
    open,
    match,
    tournamentId,
    firstAttackUserId,
    scorePlayer1,
    scorePlayer2,
    endInning,
    highRunPlayer1,
    highRunPlayer2,
    winnerUserId,
  ]);

  const preview = useMemo(() => {
    if (!match || !matchCompleted) return null;
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
      winnerUserId,
      scorePlayer1: s1,
      scorePlayer2: s2,
      endInning: E,
    });
  }, [endInning, firstAttackUserId, match, matchCompleted, scorePlayer1, scorePlayer2, winnerUserId]);

  const parseOptionalInt = (raw: string): number | null | "bad" => {
    const t = raw.trim();
    if (t === "") return null;
    const n = Math.floor(Number(t));
    if (!Number.isFinite(n) || n < 0) return "bad";
    return n;
  };

  const handleSwapBreak = useCallback(() => {
    if (!match) return;
    setFirstAttackUserId((prev) => {
      const cur = prev.trim() || match.player1.userId;
      return cur === match.player1.userId ? match.player2.userId : match.player1.userId;
    });
  }, [match]);

  const handleSave = useCallback(async () => {
    if (!match || !tournamentId.trim()) return;
    if (!matchCompleted) {
      window.alert("먼저 승패를 선택해 주세요.");
      return;
    }
    const fa = firstAttackUserId.trim() || match.player1.userId;
    const s1 = Math.floor(Number(scorePlayer1));
    const s2 = Math.floor(Number(scorePlayer2));
    const E = Math.floor(Number(endInning));
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0) {
      setFormError("점수를 확인해 주세요.");
      return;
    }
    if (!Number.isFinite(E) || E < 1) {
      setFormError("승자 이닝을 확인해 주세요.");
      return;
    }
    const hr1 = parseOptionalInt(highRunPlayer1);
    const hr2 = parseOptionalInt(highRunPlayer2);
    if (hr1 === "bad" || hr2 === "bad") {
      setFormError("하이런 값이 올바르지 않습니다. 비워 두면 미입력으로 저장됩니다.");
      return;
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
      clearQuickResultDetailDraft(tournamentId, match.id);
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
    highRunPlayer1,
    highRunPlayer2,
    match,
    matchCompleted,
    onClose,
    onSaved,
    scorePlayer1,
    scorePlayer2,
    tournamentId,
  ]);

  if (!open || !match) return null;

  const p1InningDisplay = () => {
    if (!matchCompleted) return <span className={styles.emptyDash}>—</span>;
    if (p1Win) {
      return (
        <input
          className={styles.cellInput}
          inputMode="numeric"
          value={endInning}
          onChange={(e) => setEndInning(e.target.value)}
          disabled={disabled || saveBusy}
          aria-label="승자 이닝"
        />
      );
    }
    if (preview) return <span className={styles.computed}>{preview.inn1}</span>;
    return <span className={styles.emptyDash}>—</span>;
  };

  const p2InningDisplay = () => {
    if (!matchCompleted) return <span className={styles.emptyDash}>—</span>;
    if (p2Win) {
      return (
        <input
          className={styles.cellInput}
          inputMode="numeric"
          value={endInning}
          onChange={(e) => setEndInning(e.target.value)}
          disabled={disabled || saveBusy}
          aria-label="승자 이닝"
        />
      );
    }
    if (preview) return <span className={styles.computed}>{preview.inn2}</span>;
    return <span className={styles.emptyDash}>—</span>;
  };

  const p1AvgDisplay = preview ? formatAvg3(preview.avg1) : "—";
  const p2AvgDisplay = preview ? formatAvg3(preview.avg2) : "—";

  return (
    <div
      role="presentation"
      className={styles.overlay}
      onClick={() => (!saveBusy && !disabled ? onClose() : null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-detail-title"
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.toolbar}>
          <h2 id="qr-detail-title" className={styles.title}>
            상세 입력
          </h2>
          <button
            type="button"
            className={styles.swapBtn}
            onClick={handleSwapBreak}
            disabled={disabled || saveBusy}
          >
            선구 변경
          </button>
        </div>
        <p className={styles.hint}>승패는 목록의 승·패 버튼으로만 반영됩니다. 여기서는 기록만 저장합니다.</p>

        <table className={styles.recordTable}>
          <thead>
            <tr>
              <th className={styles.labelCol} aria-hidden />
              <th className={styles.playerCol}>
                <div className={styles.playerHead}>
                  <span>{p1Label}</span>
                  {matchCompleted ? (
                    p1Win ? <ResultPill label="승" variant="win" /> : p2Win ? <ResultPill label="패" variant="lose" /> : null
                  ) : null}
                  {p1IsFirst ? <BreakIndicator kind="first" /> : p2IsFirst ? <BreakIndicator kind="second" /> : null}
                </div>
              </th>
              <th className={styles.playerCol}>
                <div className={styles.playerHead}>
                  <span>{p2Label}</span>
                  {matchCompleted ? (
                    p2Win ? <ResultPill label="승" variant="win" /> : p1Win ? <ResultPill label="패" variant="lose" /> : null
                  ) : null}
                  {p2IsFirst ? <BreakIndicator kind="first" /> : p1IsFirst ? <BreakIndicator kind="second" /> : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.labelCol}>점수</td>
              <td className={styles.playerCol}>
                <input
                  className={styles.cellInput}
                  inputMode="numeric"
                  value={scorePlayer1}
                  onChange={(e) => setScorePlayer1(e.target.value)}
                  disabled={disabled || saveBusy || !matchCompleted}
                />
              </td>
              <td className={styles.playerCol}>
                <input
                  className={styles.cellInput}
                  inputMode="numeric"
                  value={scorePlayer2}
                  onChange={(e) => setScorePlayer2(e.target.value)}
                  disabled={disabled || saveBusy || !matchCompleted}
                />
              </td>
            </tr>
            <tr>
              <td className={styles.labelCol}>이닝</td>
              <td className={styles.playerCol}>{p1InningDisplay()}</td>
              <td className={styles.playerCol}>{p2InningDisplay()}</td>
            </tr>
            <tr>
              <td className={styles.labelCol}>AVG</td>
              <td className={styles.playerCol}>
                <span className={preview ? styles.computed : styles.emptyDash}>{p1AvgDisplay}</span>
              </td>
              <td className={styles.playerCol}>
                <span className={preview ? styles.computed : styles.emptyDash}>{p2AvgDisplay}</span>
              </td>
            </tr>
            <tr>
              <td className={styles.labelCol}>하이런</td>
              <td className={styles.playerCol}>
                <OptionalHighRunInput
                  value={highRunPlayer1}
                  onChange={setHighRunPlayer1}
                  disabled={disabled || saveBusy || !matchCompleted}
                  ariaLabel="선수1 하이런"
                />
              </td>
              <td className={styles.playerCol}>
                <OptionalHighRunInput
                  value={highRunPlayer2}
                  onChange={setHighRunPlayer2}
                  disabled={disabled || saveBusy || !matchCompleted}
                  ariaLabel="선수2 하이런"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {formError ? <p className={styles.formError}>{formError}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={`v3-btn ${styles.actionBtn}`} disabled={saveBusy || disabled} onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className={`ui-btn-primary-solid ${styles.saveBtn}`}
            disabled={saveBusy || disabled || !matchCompleted}
            onClick={() => void handleSave()}
          >
            {saveBusy ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
