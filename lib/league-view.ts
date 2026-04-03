export type LeagueSummary = {
  id: string;
  kind: "MAIN" | "ZONE" | "FINAL";
  zoneId: string | null;
  status: "DRAFT" | "GENERATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  generatedAt: string | null;
  completedAt: string | null;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  tieBreaker: "HEAD_TO_HEAD" | "SCORE_DIFF" | "SCORE_FOR" | "DRAW_COUNT";
  counts: {
    entries: number;
    rounds: number;
    matches: number;
    standings: number;
  };
};

export type LeagueEntryView = {
  id: string;
  tournamentEntryId: string;
  displayName: string;
  levelCode: string | null;
  seedNumber: number | null;
  sortOrder: number;
  status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
  isAutoRegistered: boolean;
  registeredAt: string;
  withdrawnAt: string | null;
};

export type LeagueMatchView = {
  id: string;
  roundId: string;
  matchNumber: number;
  leagueEntryIdA: string | null;
  leagueEntryIdB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  isWalkover: boolean;
  isManualOverride: boolean;
  isForcedZeroPoint: boolean;
  winnerLeagueEntryId: string | null;
  note: string | null;
  leagueEntryA: LeagueEntryView | null;
  leagueEntryB: LeagueEntryView | null;
  winnerLeagueEntry: LeagueEntryView | null;
};

export type LeagueRoundView = {
  id: string;
  roundNumber: number;
  name: string;
  matches: LeagueMatchView[];
};

export type LeagueStandingView = {
  id: string;
  entryId: string;
  leagueEntryId: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDiff: number;
  rank: number | null;
  leagueEntry: LeagueEntryView | null;
};

export type LeagueDetailView = {
  id: string;
  tournamentId: string;
  zoneId: string | null;
  kind: "MAIN" | "ZONE" | "FINAL";
  status: "DRAFT" | "GENERATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  tieBreaker: "HEAD_TO_HEAD" | "SCORE_DIFF" | "SCORE_FOR" | "DRAW_COUNT";
  generatedAt: string | null;
  completedAt: string | null;
  entries: LeagueEntryView[];
  rounds: LeagueRoundView[];
  matches: LeagueMatchView[];
  standings: LeagueStandingView[];
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

export function serializeLeagueSummary(league: {
  id: string;
  kind: "MAIN" | "ZONE" | "FINAL";
  zoneId: string | null;
  status: "DRAFT" | "GENERATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  generatedAt: Date | string | null;
  completedAt: Date | string | null;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  tieBreaker: "HEAD_TO_HEAD" | "SCORE_DIFF" | "SCORE_FOR" | "DRAW_COUNT";
  _count: { entries: number; rounds: number; matches: number; standings: number };
}): LeagueSummary {
  return {
    id: league.id,
    kind: league.kind,
    zoneId: league.zoneId,
    status: league.status,
    generatedAt: toIso(league.generatedAt),
    completedAt: toIso(league.completedAt),
    pointsForWin: league.pointsForWin,
    pointsForDraw: league.pointsForDraw,
    pointsForLoss: league.pointsForLoss,
    tieBreaker: league.tieBreaker,
    counts: league._count,
  };
}

export function serializeLeagueDetail(league: {
  id: string;
  tournamentId: string;
  zoneId: string | null;
  kind: "MAIN" | "ZONE" | "FINAL";
  status: "DRAFT" | "GENERATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  tieBreaker: "HEAD_TO_HEAD" | "SCORE_DIFF" | "SCORE_FOR" | "DRAW_COUNT";
  generatedAt: Date | string | null;
  completedAt: Date | string | null;
  entries: Array<{
    id: string;
    tournamentEntryId: string;
    displayName: string;
    levelCode: string | null;
    seedNumber: number | null;
    sortOrder: number;
    status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
    isAutoRegistered: boolean;
    registeredAt: Date | string;
    withdrawnAt: Date | string | null;
  }>;
  rounds: Array<{
    id: string;
    roundNumber: number;
    name: string;
    matches: Array<{
      id: string;
      roundId: string;
      matchNumber: number;
      leagueEntryIdA: string | null;
      leagueEntryIdB: string | null;
      scoreA: number | null;
      scoreB: number | null;
      status: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
      isWalkover: boolean;
      isManualOverride: boolean;
      isForcedZeroPoint: boolean;
      winnerLeagueEntryId: string | null;
      note: string | null;
      leagueEntryA?: null | {
        id: string;
        tournamentEntryId: string;
        displayName: string;
        levelCode: string | null;
        seedNumber: number | null;
        sortOrder: number;
        status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
        isAutoRegistered: boolean;
        registeredAt: Date | string;
        withdrawnAt: Date | string | null;
      };
      leagueEntryB?: null | {
        id: string;
        tournamentEntryId: string;
        displayName: string;
        levelCode: string | null;
        seedNumber: number | null;
        sortOrder: number;
        status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
        isAutoRegistered: boolean;
        registeredAt: Date | string;
        withdrawnAt: Date | string | null;
      };
      winnerLeagueEntry?: null | {
        id: string;
        tournamentEntryId: string;
        displayName: string;
        levelCode: string | null;
        seedNumber: number | null;
        sortOrder: number;
        status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
        isAutoRegistered: boolean;
        registeredAt: Date | string;
        withdrawnAt: Date | string | null;
      };
    }>;
  }>;
  matches: Array<{
    id: string;
    roundId: string;
    matchNumber: number;
    leagueEntryIdA: string | null;
    leagueEntryIdB: string | null;
    scoreA: number | null;
    scoreB: number | null;
    status: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    isWalkover: boolean;
    isManualOverride: boolean;
    winnerLeagueEntryId: string | null;
    note: string | null;
    leagueEntryA?: null | {
      id: string;
      tournamentEntryId: string;
      displayName: string;
      levelCode: string | null;
      seedNumber: number | null;
      sortOrder: number;
      status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
      isAutoRegistered: boolean;
      registeredAt: Date | string;
      withdrawnAt: Date | string | null;
    };
    leagueEntryB?: null | {
      id: string;
      tournamentEntryId: string;
      displayName: string;
      levelCode: string | null;
      seedNumber: number | null;
      sortOrder: number;
      status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
      isAutoRegistered: boolean;
      registeredAt: Date | string;
      withdrawnAt: Date | string | null;
    };
    winnerLeagueEntry?: null | {
      id: string;
      tournamentEntryId: string;
      displayName: string;
      levelCode: string | null;
      seedNumber: number | null;
      sortOrder: number;
      status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
      isAutoRegistered: boolean;
      registeredAt: Date | string;
      withdrawnAt: Date | string | null;
    };
  }>;
  standings: Array<{
    id: string;
    entryId: string;
    leagueEntryId: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    points: number;
    scoreFor: number;
    scoreAgainst: number;
    scoreDiff: number;
    rank: number | null;
    leagueEntry?: null | {
      id: string;
      tournamentEntryId: string;
      displayName: string;
      levelCode: string | null;
      seedNumber: number | null;
      sortOrder: number;
      status: "ACTIVE" | "WITHDRAWN" | "EXCLUDED";
      isAutoRegistered: boolean;
      registeredAt: Date | string;
      withdrawnAt: Date | string | null;
    };
  }>;
}): LeagueDetailView {
  const serializeEntry = (entry: any): LeagueEntryView => ({
    id: entry.id,
    tournamentEntryId: entry.tournamentEntryId,
    displayName: entry.displayName,
    levelCode: entry.levelCode,
    seedNumber: entry.seedNumber,
    sortOrder: entry.sortOrder,
    status: entry.status,
    isAutoRegistered: entry.isAutoRegistered,
    registeredAt: toIso(entry.registeredAt) ?? new Date().toISOString(),
    withdrawnAt: toIso(entry.withdrawnAt),
  });

  const serializeMatch = (match: any): LeagueMatchView => ({
    id: match.id,
    roundId: match.roundId,
    matchNumber: match.matchNumber,
    leagueEntryIdA: match.leagueEntryIdA,
    leagueEntryIdB: match.leagueEntryIdB,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    status: match.status,
    isWalkover: match.isWalkover,
    isManualOverride: match.isManualOverride,
    isForcedZeroPoint: match.isForcedZeroPoint,
    winnerLeagueEntryId: match.winnerLeagueEntryId,
    note: match.note,
    leagueEntryA: match.leagueEntryA ? serializeEntry(match.leagueEntryA) : null,
    leagueEntryB: match.leagueEntryB ? serializeEntry(match.leagueEntryB) : null,
    winnerLeagueEntry: match.winnerLeagueEntry ? serializeEntry(match.winnerLeagueEntry) : null,
  });

  return {
    id: league.id,
    tournamentId: league.tournamentId,
    zoneId: league.zoneId,
    kind: league.kind,
    status: league.status,
    pointsForWin: league.pointsForWin,
    pointsForDraw: league.pointsForDraw,
    pointsForLoss: league.pointsForLoss,
    tieBreaker: league.tieBreaker,
    generatedAt: toIso(league.generatedAt),
    completedAt: toIso(league.completedAt),
    entries: league.entries.map(serializeEntry),
    rounds: league.rounds.map((round) => ({
      id: round.id,
      roundNumber: round.roundNumber,
      name: round.name,
      matches: round.matches.map(serializeMatch),
    })),
    matches: league.matches.map(serializeMatch),
    standings: league.standings.map((standing) => ({
      id: standing.id,
      entryId: standing.entryId,
      leagueEntryId: standing.leagueEntryId,
      played: standing.played,
      won: standing.won,
      drawn: standing.drawn,
      lost: standing.lost,
      points: standing.points,
      scoreFor: standing.scoreFor,
      scoreAgainst: standing.scoreAgainst,
      scoreDiff: standing.scoreDiff,
      rank: standing.rank,
      leagueEntry: standing.leagueEntry ? serializeEntry(standing.leagueEntry) : null,
    })),
  };
}
