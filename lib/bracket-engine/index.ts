export type BracketSeedMode = "RANDOM" | "LEVEL_BASED" | "MANUAL";
export type BracketByeStrategy = "EARLY" | "ROUND_BASED";
export type BracketMatchStatus = "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type BracketSeedEntry = {
  entryId: string;
  levelCode?: string | null;
  duplicateGroupKey?: string | null;
  bracketOrder?: number | null;
};

export type BracketMatchPlanRow = {
  roundNumber: number;
  matchNumber: number;
  entryIdA: string | null;
  entryIdB: string | null;
  isBye: boolean;
  isReduction: boolean;
  status: BracketMatchStatus;
  nextMatchKey: string | null;
  nextSlot: "A" | "B" | null;
};

export function nextPowerOfTwo(count: number, minSize = 2): number {
  if (count <= 0) return 0;
  let size = Math.max(2, minSize);
  while (size < count) size *= 2;
  return size;
}

export function buildSingleElimPlan(args: {
  entries: BracketSeedEntry[];
  targetFinalSize?: number | null;
  byeStrategy?: BracketByeStrategy;
  seedMode?: BracketSeedMode;
}): BracketMatchPlanRow[] {
  const seedMode = args.seedMode ?? "RANDOM";
  const byeStrategy = args.byeStrategy ?? "EARLY";
  const entries = [...args.entries];
  if (seedMode === "LEVEL_BASED") {
    entries.sort((a, b) => {
      const levelA = (a.levelCode ?? "").localeCompare(b.levelCode ?? "");
      if (levelA !== 0) return levelA;
      return a.entryId.localeCompare(b.entryId);
    });
  } else if (seedMode === "MANUAL") {
    entries.sort((a, b) => (a.bracketOrder ?? 0) - (b.bracketOrder ?? 0) || a.entryId.localeCompare(b.entryId));
  } else {
    entries.sort((a, b) => a.entryId.localeCompare(b.entryId));
  }

  const targetSize = Math.max(args.targetFinalSize ?? 0, nextPowerOfTwo(entries.length, 2));
  const slots: (BracketSeedEntry | null)[] = entries.slice();
  while (slots.length < targetSize) slots.push(null);

  const rounds = Math.max(1, Math.log2(targetSize));
  const rows: BracketMatchPlanRow[] = [];
  for (let roundNumber = 0; roundNumber < rounds; roundNumber++) {
    const matchesInRound = targetSize / Math.pow(2, roundNumber + 1);
    for (let matchNumber = 0; matchNumber < matchesInRound; matchNumber++) {
      const entryA = roundNumber === 0 ? slots[matchNumber * 2] ?? null : null;
      const entryB = roundNumber === 0 ? slots[matchNumber * 2 + 1] ?? null : null;
      const isBye = entryA == null || entryB == null;
      rows.push({
        roundNumber,
        matchNumber,
        entryIdA: entryA?.entryId ?? null,
        entryIdB: entryB?.entryId ?? null,
        isBye,
        isReduction: byeStrategy === "ROUND_BASED" && isBye,
        status: isBye ? "READY" : "PENDING",
        nextMatchKey: null,
        nextSlot: null,
      });
    }
  }

  for (const row of rows) {
    const nextRound = row.roundNumber + 1;
    const nextMatchNumber = Math.floor(row.matchNumber / 2);
    const nextSlot = row.matchNumber % 2 === 0 ? "A" : "B";
    const next = rows.find((x) => x.roundNumber === nextRound && x.matchNumber === nextMatchNumber);
    if (next) {
      row.nextMatchKey = `${next.roundNumber}:${next.matchNumber}`;
      row.nextSlot = nextSlot;
    }
  }

  return rows;
}

export function propagateWinner(args: {
  matches: BracketMatchPlanRow[];
  matchKey: string;
  winnerEntryId: string;
}): BracketMatchPlanRow[] {
  const out = args.matches.map((m) => ({ ...m }));
  const current = out.find((m) => `${m.roundNumber}:${m.matchNumber}` === args.matchKey);
  if (!current) return out;

  const next = current.nextMatchKey
    ? out.find((m) => `${m.roundNumber}:${m.matchNumber}` === current.nextMatchKey)
    : null;
  if (!next || !current.nextSlot) return out;

  if (current.nextSlot === "A") {
    next.entryIdA = args.winnerEntryId;
  } else {
    next.entryIdB = args.winnerEntryId;
  }
  if (next.entryIdA && next.entryIdB && next.status === "PENDING") {
    next.status = "READY";
  }
  return out;
}

export function applyManualOverride(args: {
  match: BracketMatchPlanRow;
  patch: Partial<Pick<BracketMatchPlanRow, "entryIdA" | "entryIdB" | "isBye" | "isReduction" | "status">>;
}): BracketMatchPlanRow {
  return { ...args.match, ...args.patch };
}

export function pickReductionCandidates<T extends { id: string; levelCode?: string | null }>(
  items: T[],
  targetCount: number
): T[] {
  if (targetCount <= 0 || items.length <= targetCount) return [];
  const sorted = [...items].sort((a, b) => {
    const la = a.levelCode ?? "";
    const lb = b.levelCode ?? "";
    if (la !== lb) return la.localeCompare(lb);
    return a.id.localeCompare(b.id);
  });
  return sorted.slice(targetCount);
}
