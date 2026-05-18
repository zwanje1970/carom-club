import { randomUUID } from "crypto";

import { getShuffleRoundBlockedReason } from "../bracket-shuffle-guards";
import { emptyBracketPlayerSlot, isBracketSlotDataEmpty } from "../bracket-player-slot";

import type {
  BracketPlayer,
  MutableBracket,
  MutableBracketMatch,
  MutableBracketRound,
} from "./platform-backing-store";
import { deriveRoundStatus } from "./platform-backing-store";

export type MutableRoundSlice = {
  key: string;
  rounds: MutableBracketRound[];
};

/** 라운드 트리 목록 (단일 대진표는 root 한 개) */
export function listMutableRoundSlices(bracket: MutableBracket): MutableRoundSlice[] {
  if (
    bracket.bracketMode === "multi_block" &&
    Array.isArray(bracket.blocks) &&
    bracket.blocks.length > 0
  ) {
    const out: MutableRoundSlice[] = bracket.blocks.map((block) => ({
      key: `block:${block.id}`,
      rounds: block.rounds,
    }));
    if (bracket.finalBlock?.rounds?.length) {
      out.push({ key: "final", rounds: bracket.finalBlock.rounds });
    }
    return out;
  }
  return [{ key: "root", rounds: bracket.rounds }];
}

export function findMutableMatchById(
  bracket: MutableBracket,
  matchId: string,
): { sliceKey: string; rounds: MutableBracketRound[]; round: MutableBracketRound; match: MutableBracketMatch } | null {
  const id = matchId.trim();
  if (!id) return null;
  for (const slice of listMutableRoundSlices(bracket)) {
    for (const round of slice.rounds) {
      const match = round.matches.find((m) => m.id === id);
      if (match) return { sliceKey: slice.key, rounds: slice.rounds, round, match };
    }
  }
  return null;
}

export function sliceKeyForBlockId(blockId: string): string {
  return `block:${blockId.trim()}`;
}

export function resolveRoundsForSliceKey(
  bracket: MutableBracket,
  sliceKey: string | undefined,
): MutableBracketRound[] | null {
  const key = (sliceKey ?? "").trim();
  if (bracket.bracketMode === "multi_block" && bracket.blocks?.length) {
    if (!key) return null;
    if (key === "final") return bracket.finalBlock?.rounds ?? null;
    if (key.startsWith("block:")) {
      const bid = key.slice("block:".length);
      const block = bracket.blocks.find((b) => b.id === bid);
      return block?.rounds ?? null;
    }
    return null;
  }
  if (!key || key === "root") return bracket.rounds;
  return null;
}

export function collectAllPlayersFromBracket(bracket: MutableBracket): Map<string, BracketPlayer> {
  const playerMap = new Map<string, BracketPlayer>();
  for (const slice of listMutableRoundSlices(bracket)) {
    for (const round of slice.rounds) {
      for (const match of round.matches) {
        const u1 = match.player1.userId?.trim() ?? "";
        const u2 = match.player2.userId?.trim() ?? "";
        if (u1) playerMap.set(u1, match.player1);
        if (u2) playerMap.set(u2, match.player2);
      }
    }
  }
  return playerMap;
}

export function hasDownstreamRoundInSlice(rounds: MutableBracketRound[], afterRoundNumber: number): boolean {
  return rounds.some((r) => r.roundNumber > afterRoundNumber);
}

export function truncateRoundsAfterInSlice(rounds: MutableBracketRound[], roundNumber: number): void {
  const filtered = rounds.filter((round) => round.roundNumber <= roundNumber);
  rounds.length = 0;
  rounds.push(...filtered);
}

export function normalizeRoundStatusesInSlice(rounds: MutableBracketRound[]): void {
  for (const round of rounds) {
    round.status = deriveRoundStatus(round.matches);
  }
}

export function normalizeRoundStatusesEverywhere(mut: MutableBracket): void {
  for (const slice of listMutableRoundSlices(mut)) {
    normalizeRoundStatusesInSlice(slice.rounds);
  }
}

export function bracketMatchListHasAnyRealParticipant(matches: MutableBracketMatch[]): boolean {
  return matches.some((m) => !isBracketSlotDataEmpty(m.player1) || !isBracketSlotDataEmpty(m.player2));
}

/** 슬라이스 내 최소 roundNumber(운영 시작 라운드)는 유지, 그 외 실참가자 0명 라운드는 제거 */
export function pruneEmptyRoundsFromSliceInPlace(rounds: MutableBracketRound[]): void {
  if (rounds.length === 0) return;
  const minRn = Math.min(...rounds.map((r) => r.roundNumber));
  const kept = rounds.filter(
    (r) => r.roundNumber === minRn || bracketMatchListHasAnyRealParticipant(r.matches),
  );
  if (kept.length !== rounds.length) {
    rounds.length = 0;
    rounds.push(...kept);
  }
  normalizeRoundStatusesInSlice(rounds);
}

function matchWinnerPlayerOrNull(match: MutableBracketMatch): BracketPlayer | null {
  if (match.status !== "COMPLETED") return null;
  const wid = typeof match.winnerUserId === "string" ? match.winnerUserId.trim() : "";
  const wnm = typeof match.winnerName === "string" ? match.winnerName.trim() : "";
  if (!wid || !wnm) return null;
  return { userId: wid, name: wnm };
}

export function buildNextRoundMatchesFromRoundSlice(params: {
  currentRound: MutableBracketRound;
  nextRoundNumber: number;
  allowPartial: boolean;
}): MutableBracketMatch[] | null {
  const { currentRound, nextRoundNumber, allowPartial } = params;
  const pairCount = Math.floor(currentRound.matches.length / 2);
  const nextMatches: MutableBracketMatch[] = [];
  for (let i = 0; i < pairCount; i += 1) {
    const m1 = currentRound.matches[i * 2]!;
    const m2 = currentRound.matches[i * 2 + 1]!;
    const w1 = matchWinnerPlayerOrNull(m1);
    const w2 = matchWinnerPlayerOrNull(m2);
    if (!allowPartial && (!w1 || !w2)) {
      return null;
    }
    nextMatches.push({
      id: randomUUID(),
      player1: w1 ?? emptyBracketPlayerSlot(),
      player2: w2 ?? emptyBracketPlayerSlot(),
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }
  if (nextMatches.length > 0 && !bracketMatchListHasAnyRealParticipant(nextMatches)) {
    return null;
  }
  return nextMatches;
}

/** 블록 최종 라운드(단일 매치) 우승자 — 미결정 시 null */
export function extractBlockWinnerPlayer(block: { rounds: MutableBracketRound[] }): BracketPlayer | null {
  const last = block.rounds[block.rounds.length - 1];
  if (!last || last.matches.length !== 1) return null;
  const m = last.matches[0]!;
  if (m.status !== "COMPLETED" || !m.winnerUserId?.trim() || !m.winnerName?.trim()) return null;
  return m.winnerUserId === m.player1.userId ? m.player1 : m.player2;
}

/** 예선 블록 우승자 표시명을 결선 1라운드 슬롯에 복사 (수동 슬롯은 제외) */
export function syncFinalBlockFromQualifiersInPlace(bracket: MutableBracket): void {
  if (bracket.bracketMode !== "multi_block" || !bracket.blocks?.length || !bracket.finalBlock?.rounds?.length) {
    return;
  }
  const r1 = bracket.finalBlock.rounds.find((r) => r.roundNumber === 1);
  if (!r1) return;
  const manual = bracket.finalBlockSlotManual ?? {};
  for (let blockIndex = 0; blockIndex < bracket.blocks.length; blockIndex += 1) {
    if (manual[String(blockIndex)]) continue;
    const block = bracket.blocks[blockIndex]!;
    const w = extractBlockWinnerPlayer(block);
    const p: BracketPlayer = w ?? emptyBracketPlayerSlot();
    const matchIdx = Math.floor(blockIndex / 2);
    const useP1 = blockIndex % 2 === 0;
    const match = r1.matches[matchIdx];
    if (!match) continue;
    if (useP1) match.player1 = { ...p };
    else match.player2 = { ...p };
    match.winnerUserId = null;
    match.winnerName = null;
    match.status = "PENDING";
  }
  normalizeRoundStatusesInSlice(bracket.finalBlock.rounds);
  pruneEmptyRoundsFromSliceInPlace(bracket.finalBlock.rounds);
}

/** 지정 라운드 슬롯만 Fisher–Yates 재배열. 상위 라운드는 truncate 후 해당 라운드 승자만 초기화 */
export function shuffleRoundSlotValuesInSlice(rounds: MutableBracketRound[], roundNumber: number): void {
  const blocked = getShuffleRoundBlockedReason(rounds, roundNumber);
  if (blocked) throw new Error(blocked);

  truncateRoundsAfterInSlice(rounds, roundNumber);
  const target = rounds.find((r) => r.roundNumber === roundNumber);
  if (!target?.matches.length) return;

  const cells: BracketPlayer[] = [];
  for (const m of target.matches) {
    cells.push({ ...m.player1 }, { ...m.player2 });
  }
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = cells[i]!;
    cells[i] = cells[j]!;
    cells[j] = t;
  }
  let k = 0;
  for (const m of target.matches) {
    m.player1 = cells[k]!;
    m.player2 = cells[k + 1]!;
    k += 2;
    m.winnerUserId = null;
    m.winnerName = null;
    m.status = "PENDING";
  }
  pruneEmptyRoundsFromSliceInPlace(rounds);
}

export function shuffleRoundOneSlotValuesInSlice(rounds: MutableBracketRound[]): void {
  shuffleRoundSlotValuesInSlice(rounds, 1);
}

export function rebuildChainFromRoundInSlice(params: {
  rounds: MutableBracketRound[];
  startRoundNumber: number;
  allowPartial: boolean;
}): void {
  const { rounds, startRoundNumber, allowPartial } = params;
  truncateRoundsAfterInSlice(rounds, startRoundNumber);
  let currentRoundNumber = startRoundNumber;
  while (true) {
    const currentRound = rounds.find((r) => r.roundNumber === currentRoundNumber);
    if (!currentRound) break;
    if (!allowPartial && currentRound.status !== "COMPLETED") break;
    const nextRoundNumber = currentRoundNumber + 1;
    const nextMatches = buildNextRoundMatchesFromRoundSlice({
      currentRound,
      nextRoundNumber,
      allowPartial,
    });
    if (!nextMatches || nextMatches.length === 0) break;
    if (!bracketMatchListHasAnyRealParticipant(nextMatches)) break;
    rounds.push({
      roundNumber: nextRoundNumber,
      matches: nextMatches,
      status: "PENDING",
    });
    currentRoundNumber = nextRoundNumber;
    if (nextMatches.length === 1) break;
  }
  pruneEmptyRoundsFromSliceInPlace(rounds);
}
