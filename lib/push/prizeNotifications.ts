import { prisma } from "@/lib/db";
import { sendPushToUser } from "./sendPush";

export type Top3 = {
  firstUserId: string | null;
  secondUserId: string | null;
  thirdUserIds: string[];
};

/**
 * 단판 토너먼트 브래킷에서 1·2·3위 사용자 추출.
 * `BracketMatch` 우선, 레거시 `TournamentRound.bracketData`는 호환용.
 */
export async function getTop3FromTournament(tournamentId: string): Promise<Top3> {
  const result: Top3 = { firstUserId: null, secondUserId: null, thirdUserIds: [] };

  const finalMatches = await prisma.bracketMatch.findMany({
    where: { bracket: { tournamentId, kind: "MAIN" } },
    include: { round: { select: { roundNumber: true } } },
    orderBy: [{ round: { roundNumber: "desc" } }, { matchNumber: "asc" }],
  });
  if (finalMatches.length > 0) {
    const maxRound = Math.max(...finalMatches.map((m) => m.round.roundNumber));
    const finalMatch = finalMatches.find((m) => m.round.roundNumber === maxRound && m.matchNumber === 0);
    if (finalMatch?.winnerEntryId && (finalMatch.entryIdA || finalMatch.entryIdB)) {
      const winnerId = finalMatch.winnerEntryId;
      const loserId = finalMatch.entryIdA === winnerId ? finalMatch.entryIdB : finalMatch.entryIdA;
      const winnerEntry = await prisma.tournamentEntry.findUnique({ where: { id: winnerId }, select: { userId: true } });
      const loserEntry = loserId ? await prisma.tournamentEntry.findUnique({ where: { id: loserId }, select: { userId: true } }) : null;
      if (winnerEntry) result.firstUserId = winnerEntry.userId;
      if (loserEntry) result.secondUserId = loserEntry.userId;
    }
    const semiRound = maxRound - 1;
    if (semiRound >= 0) {
      const semiMatches = finalMatches.filter((m) => m.round.roundNumber === semiRound);
      const semiLoserEntryIds = semiMatches
        .map((m) => (m.winnerEntryId === m.entryIdA ? m.entryIdB : m.entryIdA))
        .filter((id): id is string => !!id);
      for (const entryId of semiLoserEntryIds) {
        const e = await prisma.tournamentEntry.findUnique({ where: { id: entryId }, select: { userId: true } });
        if (e && !result.thirdUserIds.includes(e.userId)) result.thirdUserIds.push(e.userId);
      }
    }
    return result;
  }

  const round = await prisma.tournamentRound.findFirst({
    where: { tournamentId },
    orderBy: { sortOrder: "desc" },
  });
  if (!round?.bracketData) return result;
  let data: { matches?: Array<{ entryIdA?: string; entryIdB?: string; winnerId?: string }> };
  try {
    data = typeof round.bracketData === "string" ? JSON.parse(round.bracketData) : round.bracketData;
  } catch {
    return result;
  }
  const matches = data.matches ?? [];
  const lastMatch = matches[matches.length - 1];
  if (!lastMatch?.winnerId) return result;
  const winnerEntry = await prisma.tournamentEntry.findUnique({ where: { id: lastMatch.winnerId }, select: { userId: true } });
  if (winnerEntry) result.firstUserId = winnerEntry.userId;
  const loserId = lastMatch.entryIdA === lastMatch.winnerId ? lastMatch.entryIdB : lastMatch.entryIdA;
  if (loserId) {
    const loserEntry = await prisma.tournamentEntry.findUnique({ where: { id: loserId }, select: { userId: true } });
    if (loserEntry) result.secondUserId = loserEntry.userId;
  }
  return result;
}

/**
 * 대회 종료 시 우승/준우승/준결승 빵빠레 푸시 발송.
 */
export async function sendPrizeNotifications(tournamentId: string, tournamentName: string): Promise<void> {
  const top3 = await getTop3FromTournament(tournamentId);
  const baseUrl = `/tournaments/${tournamentId}/results`;

  if (top3.firstUserId) {
    await sendPushToUser({
      userId: top3.firstUserId,
      tournamentId,
      type: "PRIZE",
      title: `축하합니다! ${tournamentName} 우승입니다.`,
      url: baseUrl,
    });
  }
  if (top3.secondUserId) {
    await sendPushToUser({
      userId: top3.secondUserId,
      tournamentId,
      type: "PRIZE",
      title: `${tournamentName} 준우승을 축하합니다.`,
      url: baseUrl,
    });
  }
  for (const userId of top3.thirdUserIds) {
    await sendPushToUser({
      userId,
      tournamentId,
      type: "PRIZE",
      title: `${tournamentName} 준결승 진출을 축하합니다.`,
      url: baseUrl,
    });
  }
}
