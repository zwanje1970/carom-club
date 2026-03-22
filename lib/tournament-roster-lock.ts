import { prisma } from "@/lib/db";

export const ROSTER_LOCKED_ENTRY_ERROR =
  "참가 명단이 대회 운영 콘솔에서 확정되었습니다. 확정자 추가·취소·반려·대기 승격·입금확인을 변경하려면 플랫폼 관리자에게 문의하세요.";

export async function isParticipantRosterLocked(tournamentId: string): Promise<boolean> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantRosterLockedAt: true },
  });
  return t?.participantRosterLockedAt != null;
}
