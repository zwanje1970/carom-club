/**
 * 12C: 권역 결과에서 본선 진출자 추출.
 * - WINNER_ONLY: 결승 승자 1명
 * - TOP_N: 결승 승·패, 준결승 패자 등 순위별 N명
 */
import { prisma } from "@/lib/db";
import { fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";

export type AdvanceRule = { advanceCount: number; advanceRuleType: string };

export type ExtractedQualifier = {
  entryId: string;
  qualifiedRank: number;
  sourceMatchId: string | null;
};

/**
 * 한 권역의 경기 결과에서 진출자 목록 추출 (토너먼트 단일 엘리미네이션 기준).
 */
export async function extractZoneQualifiers(
  tournamentZoneId: string,
  rule: AdvanceRule
): Promise<ExtractedQualifier[]> {
  const zone = await prisma.tournamentZone.findUnique({
    where: { id: tournamentZoneId },
    select: { tournamentId: true },
  });
  if (!zone) return [];

  const bracket = await fetchOrImportZoneBracketSnapshotByZoneId(zone.tournamentId, tournamentZoneId);
  const matches = bracket?.rounds.flatMap((round) => round.matches.map((match) => ({
    id: match.id,
    roundIndex: round.roundNumber,
    matchIndex: match.matchNumber,
    entryIdA: match.entryIdA,
    entryIdB: match.entryIdB,
    winnerEntryId: match.winnerEntryId,
    status: match.status,
  }))) ?? [];
  if (matches.length === 0) return [];

  const maxRound = Math.max(...matches.map((m) => m.roundIndex));
  const result: ExtractedQualifier[] = [];

  if (rule.advanceRuleType === "WINNER_ONLY" || rule.advanceCount < 1) {
    const finalMatch = matches.find((m) => m.roundIndex === maxRound && m.matchIndex === 0);
    if (finalMatch?.winnerEntryId) result.push({ entryId: finalMatch.winnerEntryId, qualifiedRank: 1, sourceMatchId: finalMatch.id });
    return result;
  }

  const need = Math.min(rule.advanceCount, 32);
  let rank = 1;

  const finalMatch = matches.find((m) => m.roundIndex === maxRound && m.matchIndex === 0);
  if (finalMatch?.status === "COMPLETED") {
    if (finalMatch.winnerEntryId) {
      result.push({ entryId: finalMatch.winnerEntryId, qualifiedRank: rank++, sourceMatchId: finalMatch.id });
    }
    if (rank <= need && finalMatch.entryIdA && finalMatch.entryIdB) {
      const loser = finalMatch.winnerEntryId === finalMatch.entryIdA ? finalMatch.entryIdB : finalMatch.entryIdA;
      if (loser) result.push({ entryId: loser, qualifiedRank: rank++, sourceMatchId: finalMatch.id });
    }
  }

  if (rank <= need && maxRound >= 1) {
    const semiMatches = matches.filter((m) => m.roundIndex === maxRound - 1);
    for (const m of semiMatches) {
      if (rank > need) break;
      if (m.status !== "COMPLETED" || !m.entryIdA || !m.entryIdB) continue;
      const loser = m.winnerEntryId === m.entryIdA ? m.entryIdB : m.entryIdA;
      if (loser) result.push({ entryId: loser, qualifiedRank: rank++, sourceMatchId: m.id });
    }
  }

  if (rank <= need && maxRound >= 2) {
    const quarterMatches = matches.filter((m) => m.roundIndex === maxRound - 2);
    for (const m of quarterMatches) {
      if (rank > need) break;
      if (m.status !== "COMPLETED" || !m.entryIdA || !m.entryIdB) continue;
      const loser = m.winnerEntryId === m.entryIdA ? m.entryIdB : m.entryIdA;
      if (loser) result.push({ entryId: loser, qualifiedRank: rank++, sourceMatchId: m.id });
    }
  }

  return result;
}

/**
 * 대회 전체 권역에서 진출자 추출 (DB에는 쓰지 않고 반환만).
 */
export async function computeAllZoneQualifiers(tournamentId: string): Promise<{
  byZone: { tournamentZoneId: string; zoneName: string; qualifiers: ExtractedQualifier[]; advanceCount: number }[];
  total: number;
}> {
  const zones = await prisma.tournamentZone.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true } } },
  });
  const byZone: { tournamentZoneId: string; zoneName: string; qualifiers: ExtractedQualifier[]; advanceCount: number }[] = [];
  let total = 0;
  for (const z of zones) {
    const rule: AdvanceRule = {
      advanceCount: z.advanceCount ?? 1,
      advanceRuleType: z.advanceRuleType ?? "WINNER_ONLY",
    };
    const qualifiers = await extractZoneQualifiers(z.id, rule);
    const advanceCount = rule.advanceRuleType === "TOP_N" ? rule.advanceCount : 1;
    byZone.push({
      tournamentZoneId: z.id,
      zoneName: z.name ?? z.zone.name,
      qualifiers,
      advanceCount,
    });
    total += qualifiers.length;
  }
  return { byZone, total };
}
