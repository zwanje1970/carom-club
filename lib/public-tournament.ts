/**
 * 14: 공개 관람용 대회 조회. 로그인 없이 접근 가능한 대회만.
 */
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_PUBLIC } from "@/lib/db-selects";

/** 비공개: HIDDEN. 그 외(OPEN, CLOSED, FINISHED, DRAFT)는 목록/상세 노출 가능. */
const PUBLIC_STATUS = ["OPEN", "CLOSED", "FINISHED", "DRAFT"] as const;

export function isTournamentPubliclyVisible(status: string | null | undefined): boolean {
  return status != null && PUBLIC_STATUS.includes(status as (typeof PUBLIC_STATUS)[number]);
}

/** 공개 가능한 대회만 조회. 없으면 null. organization은 select만. */
export async function getPublicTournamentOrNull(tournamentId: string) {
  const t = await prisma.tournament.findFirst({
    where: {
      id: tournamentId,
      status: { not: "HIDDEN" },
    },
    include: {
      organization: { select: ORGANIZATION_SELECT_PUBLIC },
    },
  });
  return t;
}
