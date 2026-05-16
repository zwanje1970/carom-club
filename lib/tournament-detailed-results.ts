import type { Bracket, BracketMatch, BracketQuickResultDetail, BracketRound } from "./server/platform-backing-store";

function slotLabel(p: { name: string; displayName?: string | null }): string {
  const d = typeof p.displayName === "string" ? p.displayName.trim() : "";
  return d || p.name.trim() || "—";
}

export function isRecordableBracketParticipantUserId(userId: string): boolean {
  const w = typeof userId === "string" ? userId.trim() : "";
  if (!w || w === "__none" || w.startsWith("__TBD__")) return false;
  return true;
}

export type DetailedResultsMatchRow = {
  opponentName: string;
  outcome: "승" | "패";
  scoreDisplay: string | null;
  inningsDisplay: string | null;
  avgDisplay: string | null;
  /** 정렬용 (상세 없으면 빈 문자열) */
  sortKey: string;
};

export type DetailedResultsPlayerBlock = {
  playerUserId: string;
  playerDisplayName: string;
  wins: number;
  losses: number;
  /** 승률 기준 순위(동률 동순) */
  rank: number | null;
  /** 상세입력 경기 1건 이상 */
  hasDetailedMatches: boolean;
  /** 경기별 AVG 합 ÷ 상세가 있는 경기 수 */
  avgMean: number | null;
  /** 단일 경기 최고 AVG */
  avgBest: number | null;
  /** 저장된 하이런 중 최대 */
  highRunBest: number | null;
  rows: DetailedResultsMatchRow[];
};

export type DetailedResultsBundle = {
  players: DetailedResultsPlayerBlock[];
};

type FlatMatch = {
  roundNumber: number;
  match: BracketMatch;
};

function* iterBracketFlatMatches(bracket: Bracket): Generator<FlatMatch> {
  const pushRound = function* (round: BracketRound): Generator<FlatMatch> {
    for (const m of round.matches ?? []) {
      yield { roundNumber: round.roundNumber, match: m };
    }
  };

  if (bracket.bracketMode === "multi_block" && Array.isArray(bracket.blocks) && bracket.blocks.length > 0) {
    for (const bl of bracket.blocks) {
      for (const r of bl.rounds ?? []) {
        yield* pushRound(r);
      }
    }
    if (bracket.finalBlock?.rounds?.length) {
      for (const r of bracket.finalBlock.rounds) {
        yield* pushRound(r);
      }
    }
    return;
  }

  for (const r of bracket.rounds ?? []) {
    yield* pushRound(r);
  }
}

function formatAvg3(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}

function pickSelfOppScores(
  selfIsP1: boolean,
  d: BracketQuickResultDetail,
): { self: number; opp: number; selfInn: number; oppInn: number; selfAvg: number; selfHr: number | null } {
  if (selfIsP1) {
    return {
      self: d.scorePlayer1,
      opp: d.scorePlayer2,
      selfInn: d.inningsPlayer1,
      oppInn: d.inningsPlayer2,
      selfAvg: d.avgPlayer1,
      selfHr: d.highRunPlayer1,
    };
  }
  return {
    self: d.scorePlayer2,
    opp: d.scorePlayer1,
    selfInn: d.inningsPlayer2,
    oppInn: d.inningsPlayer1,
    selfAvg: d.avgPlayer2,
    selfHr: d.highRunPlayer2,
  };
}

function buildRowForPlayer(
  selfUid: string,
  selfIsP1: boolean,
  p1: BracketMatch["player1"],
  p2: BracketMatch["player2"],
  winnerUid: string,
  detail: BracketQuickResultDetail | null | undefined,
): DetailedResultsMatchRow {
  const opp = selfIsP1 ? p2 : p1;
  const win = winnerUid.trim();
  const outcome: "승" | "패" = win === selfUid.trim() ? "승" : "패";
  if (!detail) {
    return {
      opponentName: slotLabel(opp),
      outcome,
      scoreDisplay: null,
      inningsDisplay: null,
      avgDisplay: null,
      sortKey: "",
    };
  }
  const po = pickSelfOppScores(selfIsP1, detail);
  const sortKey = typeof detail.recordedAt === "string" ? detail.recordedAt.trim() : "";
  return {
    opponentName: slotLabel(opp),
    outcome,
    scoreDisplay: `${po.self}:${po.opp}`,
    inningsDisplay: `${po.selfInn}이닝`,
    avgDisplay: formatAvg3(po.selfAvg),
    sortKey,
  };
}

/**
 * 확정 승패가 있는 경기만 반영. `quickResultDetail`이 있으면 점수·이닝·AVG·하이런 원본 기준으로 행을 채운다.
 */
export function buildDetailedResultsBundleFromBrackets(brackets: Bracket[]): DetailedResultsBundle {
  type Agg = {
    uid: string;
    name: string;
    wins: number;
    losses: number;
    avgSum: number;
    avgCount: number;
    avgBest: number | null;
    highRunBest: number | null;
    rows: DetailedResultsMatchRow[];
  };
  const byPlayer = new Map<string, Agg>();

  const touchPlayer = (uid: string, name: string): Agg => {
    const k = uid.trim();
    let a = byPlayer.get(k);
    if (!a) {
      a = { uid: k, name, wins: 0, losses: 0, avgSum: 0, avgCount: 0, avgBest: null, highRunBest: null, rows: [] };
      byPlayer.set(k, a);
    } else if (a.name === "—" || !a.name.trim()) {
      a.name = name;
    }
    return a;
  };

  for (const bracket of brackets) {
    for (const { match } of iterBracketFlatMatches(bracket)) {
      if (match.status !== "COMPLETED") continue;
      const w = typeof match.winnerUserId === "string" ? match.winnerUserId.trim() : "";
      if (!w) continue;
      const p1 = match.player1;
      const p2 = match.player2;
      if (!isRecordableBracketParticipantUserId(p1.userId) || !isRecordableBracketParticipantUserId(p2.userId)) {
        continue;
      }

      const d = match.quickResultDetail;
      const hasDetail = Boolean(d && typeof d.recordedAt === "string" && d.recordedAt.trim() !== "");

      for (const selfIsP1 of [true, false]) {
        const self = selfIsP1 ? p1 : p2;
        const selfUid = self.userId.trim();
        const row = buildRowForPlayer(selfUid, selfIsP1, p1, p2, w, hasDetail ? d : null);
        const agg = touchPlayer(selfUid, slotLabel(self));
        agg.rows.push(row);
        if (w === selfUid) agg.wins += 1;
        else agg.losses += 1;

        if (hasDetail && d) {
          const po = pickSelfOppScores(selfIsP1, d);
          if (Number.isFinite(po.selfAvg)) {
            agg.avgSum += po.selfAvg;
            agg.avgCount += 1;
            agg.avgBest = agg.avgBest == null ? po.selfAvg : Math.max(agg.avgBest, po.selfAvg);
          }
          if (po.selfHr != null && Number.isFinite(po.selfHr) && po.selfHr >= 0) {
            agg.highRunBest = agg.highRunBest == null ? po.selfHr : Math.max(agg.highRunBest, po.selfHr);
          }
        }
      }
    }
  }

  const players: DetailedResultsPlayerBlock[] = [...byPlayer.values()]
    .map((a) => {
      a.rows.sort((x, y) => y.sortKey.localeCompare(x.sortKey));
      const avgMean = a.avgCount > 0 ? Math.round((a.avgSum / a.avgCount) * 1000) / 1000 : null;
      const hasDetailedMatches = a.rows.some((r) => r.avgDisplay != null);
      return {
        playerUserId: a.uid,
        playerDisplayName: a.name,
        wins: a.wins,
        losses: a.losses,
        rank: null,
        hasDetailedMatches,
        avgMean,
        avgBest: a.avgBest,
        highRunBest: a.highRunBest,
        rows: a.rows,
      };
    })
    .sort((p, q) => p.playerDisplayName.localeCompare(q.playerDisplayName, "ko"));

  const rankSorted = [...players].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  let rank = 0;
  let prevKey = "";
  for (let i = 0; i < rankSorted.length; i++) {
    const p = rankSorted[i]!;
    const key = `${p.wins}:${p.losses}`;
    if (key !== prevKey) {
      rank = i + 1;
      prevKey = key;
    }
    p.rank = rank;
  }

  return { players };
}

export function pickPlayerBlock(bundle: DetailedResultsBundle, userId: string): DetailedResultsPlayerBlock | null {
  const k = userId.trim();
  return bundle.players.find((p) => p.playerUserId === k) ?? null;
}
