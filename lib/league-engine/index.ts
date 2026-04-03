export type LeagueSeedEntry = {
  entryId: string;
  displayName?: string | null;
  levelCode?: string | null;
};

export type LeagueMatchPlanRow = {
  roundNumber: number;
  matchNumber: number;
  entryIdA: string | null;
  entryIdB: string | null;
  isWalkover: boolean;
  status: "PENDING" | "READY";
};

export type LeagueStandingRow = {
  entryId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDiff: number;
};

export function buildRoundRobinPlan(entries: LeagueSeedEntry[]): LeagueMatchPlanRow[] {
  const list = [...entries];
  const odd = list.length % 2 === 1;
  if (odd) list.push({ entryId: "__BYE__", displayName: null, levelCode: null });

  const n = list.length;
  if (n < 2) return [];
  const rounds = n - 1;
  const half = n / 2;
  const rotation = list.slice();
  const plan: LeagueMatchPlanRow[] = [];

  for (let roundNumber = 0; roundNumber < rounds; roundNumber++) {
    for (let matchNumber = 0; matchNumber < half; matchNumber++) {
      const a = rotation[matchNumber];
      const b = rotation[n - 1 - matchNumber];
      const isBye = a.entryId === "__BYE__" || b.entryId === "__BYE__";
      plan.push({
        roundNumber,
        matchNumber,
        entryIdA: a.entryId === "__BYE__" ? null : a.entryId,
        entryIdB: b.entryId === "__BYE__" ? null : b.entryId,
        isWalkover: isBye,
        status: isBye ? "READY" : "PENDING",
      });
    }

    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() ?? fixed);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  return plan;
}

export function calculateLeagueStandings(args: {
  entries: LeagueSeedEntry[];
  matches: Array<{
    entryIdA: string | null;
    entryIdB: string | null;
    scoreA: number | null;
    scoreB: number | null;
    status: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    isForcedZeroPoint?: boolean;
  }>;
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
}): LeagueStandingRow[] {
  const pointsForWin = args.pointsForWin ?? 3;
  const pointsForDraw = args.pointsForDraw ?? 1;
  const pointsForLoss = args.pointsForLoss ?? 0;
  const table = new Map<string, LeagueStandingRow>();

  for (const entry of args.entries) {
    table.set(entry.entryId, {
      entryId: entry.entryId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDiff: 0,
    });
  }

  for (const match of args.matches) {
    if (match.status !== "COMPLETED") continue;
    if (!match.entryIdA || !match.entryIdB) continue;
    if (match.scoreA == null || match.scoreB == null) continue;
    const a = table.get(match.entryIdA);
    const b = table.get(match.entryIdB);
    if (!a || !b) continue;

    a.played += 1;
    b.played += 1;
    if (match.isForcedZeroPoint) {
      continue;
    }
    a.scoreFor += match.scoreA;
    a.scoreAgainst += match.scoreB;
    b.scoreFor += match.scoreB;
    b.scoreAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      a.won += 1;
      b.lost += 1;
      a.points += pointsForWin;
      b.points += pointsForLoss;
    } else if (match.scoreA < match.scoreB) {
      b.won += 1;
      a.lost += 1;
      b.points += pointsForWin;
      a.points += pointsForLoss;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.points += pointsForDraw;
      b.points += pointsForDraw;
    }
  }

  for (const row of table.values()) {
    row.scoreDiff = row.scoreFor - row.scoreAgainst;
  }

  return [...table.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
    if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
    return a.entryId.localeCompare(b.entryId);
  });
}

