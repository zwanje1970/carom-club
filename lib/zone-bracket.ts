/**
 * 권역 감축 + 정상 브래킷 계획 생성.
 * 감축경기는 독립 라운드로 만들고, 정상 라운드는 감축 결과를 반영하는 별도 단계로 만든다.
 */
import { buildSingleElimPlan } from "@/lib/bracket-engine";

export type ZoneBracketSeedEntry = {
  entryId: string;
  levelCode?: string | null;
  bracketOrder?: number | null;
};

export type ZoneBracketMatchCreate = {
  roundIndex: number;
  matchIndex: number;
  entryIdA: string | null;
  entryIdB: string | null;
  status: "PENDING" | "READY";
  isReduction: boolean;
  nextMatchId: string | null;
  nextSlot: "A" | "B" | null;
};

export type ZoneBracketRoundType = "REDUCTION" | "NORMAL";

export type ZoneBracketRoundPlan = {
  roundType: ZoneBracketRoundType;
  roundNumber: number;
  name: string;
  matches: ZoneBracketMatchCreate[];
};

export type ZoneBracketPlan = {
  baseSize: number;
  overflow: number;
  reductionMatchCount: number;
  manualReviewRequired: boolean;
  reductionPairs: Array<{
    firstIndex: number;
    secondIndex: number;
    entryA: ZoneBracketSeedEntry;
    entryB: ZoneBracketSeedEntry;
    selectionKind: "same" | "adjacent" | "fallback";
  }>;
  finalSlots: Array<{ entryId: string } | { placeholderToken: string }>;
  rounds: ZoneBracketRoundPlan[];
};

const REDUCTION_TOKEN_PREFIX = "__REDUCTION__:";

function largestPowerOfTwoAtMost(count: number): number {
  if (count < 2) return 0;
  let size = 2;
  while (size * 2 <= count) size *= 2;
  return size;
}

function parseLevelValue(levelCode?: string | null): number | null {
  if (!levelCode) return null;
  const numeric = levelCode.match(/-?\d+(?:\.\d+)?/);
  if (numeric) return Number(numeric[0]);
  const letter = levelCode.trim().match(/[A-Za-z]/);
  if (letter) return letter[0].toUpperCase().charCodeAt(0) - 64;
  return null;
}

function compareSeedEntries(a: ZoneBracketSeedEntry, b: ZoneBracketSeedEntry): number {
  const levelA = parseLevelValue(a.levelCode);
  const levelB = parseLevelValue(b.levelCode);
  if (levelA != null && levelB != null && levelA !== levelB) return levelA - levelB;
  const keyA = a.levelCode ?? "";
  const keyB = b.levelCode ?? "";
  if (keyA !== keyB) return keyA.localeCompare(keyB);
  const orderA = a.bracketOrder ?? 0;
  const orderB = b.bracketOrder ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  return a.entryId.localeCompare(b.entryId);
}

function deriveRoundName(roundNumber: number): string {
  return roundNumber === 0 ? "감축경기" : roundNumber === 1 ? "1라운드" : `${roundNumber}라운드`;
}

function pairScore(a: ZoneBracketSeedEntry, b: ZoneBracketSeedEntry): { score: number; selectionKind: "same" | "adjacent" | "fallback" } {
  if ((a.levelCode ?? "") && a.levelCode === b.levelCode) {
    return { score: 0, selectionKind: "same" };
  }
  const levelA = parseLevelValue(a.levelCode);
  const levelB = parseLevelValue(b.levelCode);
  if (levelA != null && levelB != null) {
    const diff = Math.abs(levelA - levelB);
    if (diff <= 1) {
      return { score: 1, selectionKind: "adjacent" };
    }
  }
  return { score: 2, selectionKind: "fallback" };
}

function selectReductionPairs(entries: ZoneBracketSeedEntry[], pairCount: number) {
  const used = new Set<number>();
  const pairs: Array<{
    firstIndex: number;
    secondIndex: number;
    entryA: ZoneBracketSeedEntry;
    entryB: ZoneBracketSeedEntry;
    selectionKind: "same" | "adjacent" | "fallback";
  }> = [];
  let manualReviewRequired = false;

  const shuffle = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  const pass = (kind: "same" | "adjacent" | "fallback") => {
    const candidates: typeof pairs = [];
    for (let i = 0; i < entries.length - 1; i++) {
      if (used.has(i) || used.has(i + 1)) continue;
      const pair = pairScore(entries[i], entries[i + 1]);
      if (pair.selectionKind !== kind) continue;
      candidates.push({
        firstIndex: i,
        secondIndex: i + 1,
        entryA: entries[i],
        entryB: entries[i + 1],
        selectionKind: kind,
      });
    }
    for (const candidate of shuffle(candidates)) {
      if (pairs.length >= pairCount) break;
      if (used.has(candidate.firstIndex) || used.has(candidate.secondIndex)) continue;
      pairs.push(candidate);
      used.add(candidate.firstIndex);
      used.add(candidate.secondIndex);
    }
  };

  pass("same");
  pass("adjacent");
  pass("fallback");
  manualReviewRequired = pairs.some((pair) => pair.selectionKind === "fallback") || pairs.length < pairCount;

  const sortedPairs = pairs.sort((a, b) => a.firstIndex - b.firstIndex);
  return { pairs: sortedPairs.slice(0, pairCount), manualReviewRequired };
}

function buildFinalSlots(
  entries: ZoneBracketSeedEntry[],
  pairs: Array<{
    firstIndex: number;
    secondIndex: number;
    entryA: ZoneBracketSeedEntry;
    entryB: ZoneBracketSeedEntry;
    selectionKind: "same" | "adjacent" | "fallback";
  }>
) {
  const slotByIndex = new Map<number, string>();
  pairs.forEach((pair, index) => {
    slotByIndex.set(pair.firstIndex, `${REDUCTION_TOKEN_PREFIX}${index}`);
  });

  const finalSlots: Array<{ entryId: string } | { placeholderToken: string }> = [];
  for (let i = 0; i < entries.length; i++) {
    const placeholderToken = slotByIndex.get(i);
    if (placeholderToken) {
      finalSlots.push({ placeholderToken });
      i += 1;
      continue;
    }
    if (pairs.some((pair) => pair.secondIndex === i)) {
      continue;
    }
    finalSlots.push({ entryId: entries[i]!.entryId });
  }
  return finalSlots;
}

function buildNormalRounds(finalSlots: Array<{ entryId: string } | { placeholderToken: string }>) {
  if (finalSlots.length < 2) return [];
  const normalRows = buildSingleElimPlan({
    entries: finalSlots.map((slot, bracketOrder) => ({
      entryId: "entryId" in slot ? slot.entryId : slot.placeholderToken,
      bracketOrder,
    })),
    targetFinalSize: finalSlots.length,
    seedMode: "MANUAL",
    byeStrategy: "EARLY",
  });

  const byRound = new Map<number, ZoneBracketMatchCreate[]>();
  for (const row of normalRows) {
    if (!byRound.has(row.roundNumber)) byRound.set(row.roundNumber, []);
    byRound.get(row.roundNumber)!.push({
      roundIndex: row.roundNumber + 1,
      matchIndex: row.matchNumber,
      entryIdA: row.entryIdA,
      entryIdB: row.entryIdB,
      status: row.isBye ? "READY" : "PENDING",
      isReduction: false,
      nextMatchId: null,
      nextSlot: null,
    });
  }

  return Array.from(byRound.entries())
    .sort(([a], [b]) => a - b)
    .map(([roundNumber, matches]) => ({
      roundType: "NORMAL" as const,
      roundNumber: roundNumber + 1,
      name: deriveRoundName(roundNumber + 1),
      matches,
    }));
}

/**
 * 권역 배정된 참가자(entry id + level)로 독립 감축 라운드와 정상 라운드를 포함한 브래킷 계획 생성.
 */
export function buildZoneBracket(entries: ZoneBracketSeedEntry[]): ZoneBracketPlan {
  if (entries.length < 2) {
    return {
      baseSize: entries.length,
      overflow: 0,
      reductionMatchCount: 0,
      manualReviewRequired: false,
      reductionPairs: [],
      finalSlots: entries.map((entry) => ({ entryId: entry.entryId })),
      rounds: [],
    };
  }

  const sorted = [...entries].sort(compareSeedEntries);
  const baseSize = largestPowerOfTwoAtMost(sorted.length);
  const overflow = Math.max(0, sorted.length - baseSize);
  const { pairs, manualReviewRequired } = overflow > 0 ? selectReductionPairs(sorted, overflow) : { pairs: [], manualReviewRequired: false };
  const finalSlots = overflow > 0 ? buildFinalSlots(sorted, pairs) : sorted.map((entry) => ({ entryId: entry.entryId }));

  const reductionRound: ZoneBracketRoundPlan | null =
    pairs.length > 0
      ? {
          roundType: "REDUCTION",
          roundNumber: 0,
          name: "감축경기",
          matches: pairs.map((pair, index) => ({
            roundIndex: 0,
            matchIndex: index,
            entryIdA: pair.entryA.entryId,
            entryIdB: pair.entryB.entryId,
            status: "PENDING",
            isReduction: true,
            nextMatchId: null,
            nextSlot: null,
          })),
        }
      : null;

  const normalRounds = buildNormalRounds(finalSlots);
  const rounds = reductionRound ? [reductionRound, ...normalRounds] : normalRounds;

  return {
    baseSize,
    overflow,
    reductionMatchCount: pairs.length,
    manualReviewRequired,
    reductionPairs: pairs,
    finalSlots,
    rounds,
  };
}

