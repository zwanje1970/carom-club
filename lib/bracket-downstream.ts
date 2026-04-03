import { prisma } from "@/lib/db";

/**
 * 대진표 강제 수정 시 하위 라운드 정리.
 *
 * 레거시 이름은 유지하지만 실제 저장소는 `BracketMatch`를 사용한다.
 */
export async function clearDownstreamFromMatch(
  tournamentId: string,
  matchId: string
): Promise<void> {
  const match = await prisma.bracketMatch.findFirst({
    where: { id: matchId, bracket: { tournamentId } },
  });
  if (!match?.nextMatchId || !match.nextSlot) return;

  const nextId = match.nextMatchId;
  const data =
    match.nextSlot === "A"
      ? { entryIdA: null, winnerEntryId: null, scoreA: null, scoreB: null, status: "PENDING" as const }
      : { entryIdB: null, winnerEntryId: null, scoreA: null, scoreB: null, status: "PENDING" as const };

  await prisma.bracketMatch.update({
    where: { id: nextId },
    data,
  });

  await clearDownstreamFromMatch(tournamentId, nextId);
}
