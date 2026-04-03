/**
 * 12C: 본선 32강/64강 브래킷 생성.
 * 진출자 슬롯 순서로 1라운드 매치 생성, 상위 라운드 빈 슬롯 연결.
 */
import { buildSingleElimPlan } from "@/lib/bracket-engine";

export type FinalMatchCreate = {
  roundIndex: number;
  matchIndex: number;
  entryIdA: string | null;
  entryIdB: string | null;
  status: "PENDING" | "BYE";
  nextMatchId: string | null;
  nextSlot: "A" | "B" | null;
};

/** 본선 브래킷 크기 (2의 거듭제곱) */
export type BracketSize = 4 | 8 | 16 | 32 | 64;

/**
 * 슬롯 배열(길이 size, null=BYE)로 본선 브래킷 플랜 생성.
 * round 0: slot[0] vs slot[1], slot[2] vs slot[3], ...
 */
export function buildFinalBracketPlan(
  slotEntries: (string | null)[],
  size: BracketSize
): FinalMatchCreate[] {
  return buildSingleElimPlan({
    entries: slotEntries.flatMap((entry, bracketOrder) =>
      entry ? [{ entryId: entry, bracketOrder }] : []
    ),
    targetFinalSize: size,
    seedMode: "MANUAL",
    byeStrategy: "EARLY",
  }).map((row) => ({
    roundIndex: row.roundNumber,
    matchIndex: row.matchNumber,
    entryIdA: row.entryIdA,
    entryIdB: row.entryIdB,
    status: row.isBye ? "BYE" : "PENDING",
    nextMatchId: null,
    nextSlot: null,
  }));
}

/**
 * 진출자 목록을 "같은 권역 1회전 충돌 최소화" 순서로 정렬.
 * rank 순으로 권역별로 나열: zoneA_r1, zoneB_r1, zoneC_r1, ..., zoneA_r2, zoneB_r2, ...
 */
export function orderQualifiersForAutoAssign(
  qualifiers: { entryId: string; tournamentZoneId: string; qualifiedRank: number }[]
): string[] {
  const byRank = new Map<number, { entryId: string; zoneId: string }[]>();
  for (const q of qualifiers) {
    if (!byRank.has(q.qualifiedRank)) byRank.set(q.qualifiedRank, []);
    byRank.get(q.qualifiedRank)!.push({ entryId: q.entryId, zoneId: q.tournamentZoneId });
  }
  const sorted: string[] = [];
  const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);
  for (const rank of ranks) {
    const list = byRank.get(rank)!;
    list.sort((a, b) => a.zoneId.localeCompare(b.zoneId));
    for (const x of list) sorted.push(x.entryId);
  }
  return sorted;
}
