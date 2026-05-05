/** 클라이언트 진행률 표시용 — 브래킷 데이터 구조는 변경하지 않음 */

export type BracketMatchForProgress = {
  status: "PENDING" | "COMPLETED";
  winnerUserId: string | null;
};

export type BracketRoundForProgress = {
  roundNumber: number;
  matches: BracketMatchForProgress[];
};

export type BracketForProgress = {
  rounds: BracketRoundForProgress[];
};

/** 서버·deriveRoundStatus와 동일하게 status 우선, 보조로 winnerUserId */
export function isBracketMatchCompleted(m: BracketMatchForProgress): boolean {
  if (m.status === "COMPLETED") return true;
  const w = m.winnerUserId;
  return typeof w === "string" && w.trim() !== "";
}

export function roundLabelFromMatchCount(matchCount: number): string {
  if (matchCount <= 0) return "—";
  if (matchCount === 1) return "결승";
  return `${matchCount * 2}강`;
}

export type BracketProgressComputed = {
  total: number;
  completed: number;
  remaining: number;
  currentRoundLabel: string;
  perRound: Array<{ roundNumber: number; label: string; completed: number; total: number }>;
};

export function computeBracketProgress(bracket: BracketForProgress): BracketProgressComputed {
  const sorted = [...bracket.rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  let total = 0;
  let completed = 0;
  const perRound: BracketProgressComputed["perRound"] = [];

  for (const r of sorted) {
    const t = r.matches.length;
    const c = r.matches.filter(isBracketMatchCompleted).length;
    total += t;
    completed += c;
    perRound.push({
      roundNumber: r.roundNumber,
      label: roundLabelFromMatchCount(t),
      completed: c,
      total: t,
    });
  }

  const remaining = Math.max(0, total - completed);
  let currentRoundLabel = "완료";
  for (const pr of perRound) {
    if (pr.total > 0 && pr.completed < pr.total) {
      currentRoundLabel = pr.label;
      break;
    }
  }

  return { total, completed, remaining, currentRoundLabel, perRound };
}

/** 단일 탈락제 전체 경기 수 (참가자 N명일 때 N−1) — 확정 전 미리보기 요약용 */
export function expectedTotalKnockoutMatches(participantCount: number): number {
  const n = Math.floor(Number(participantCount));
  if (!Number.isFinite(n) || n < 2) return 0;
  return n - 1;
}
