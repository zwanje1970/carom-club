import { prisma } from "@/lib/db";

/**
 * 대진표 강제 수정 시 하위 라운드 정리.
 *
 * 수정 가능 범위: 모든 라운드·모든 경기. 참가자(A/B) 강제입력·교체·추가·삭제, 승자/점수 수정 언제든 가능.
 *
 * 동작: 특정 경기의 참가자(A/B) 또는 승자 제거 시, 해당 경기 → nextMatchId 체인으로
 * 다음 경기들의 진출 슬롯(entryIdA/entryIdB)과 승자/점수를 비워 일관성을 유지.
 * 이후 관리자가 해당 경기 승자를 다시 입력하면 PATCH에서 nextMatch에 자동 반영되므로
 * 다음 라운드부터 수정된 데이터 기준으로 유지된다.
 */
export async function clearDownstreamFromMatch(
  tournamentId: string,
  matchId: string
): Promise<void> {
  const match = await prisma.tournamentFinalMatch.findFirst({
    where: { id: matchId, tournamentId },
  });
  if (!match?.nextMatchId || !match.nextSlot) return;

  const nextId = match.nextMatchId;
  const slot = match.nextSlot as "A" | "B";

  await prisma.tournamentFinalMatch.update({
    where: { id: nextId },
    data: {
      ...(slot === "A" ? { entryIdA: null } : { entryIdB: null }),
      winnerEntryId: null,
      scoreA: null,
      scoreB: null,
      status: "PENDING",
    },
  });

  await clearDownstreamFromMatch(tournamentId, nextId);
}
