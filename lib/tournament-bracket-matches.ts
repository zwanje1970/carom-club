/**
 * 단판/본선 브래킷 호환 유틸.
 *
 * 레거시 이름은 유지하지만 실제 저장은 `Bracket`/`BracketMatch`를 사용한다.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { FinalMatchCreate } from "@/lib/final-bracket";
import { createBracketMatchesFromPlanByKind, sortBracketPlan } from "@/lib/bracket-match-service";

type PrismaLike = typeof prisma;

export type BracketPhase = "MAIN" | "QUALIFIER" | "PLAY_IN";

export function sortFinalBracketPlan(plan: FinalMatchCreate[]): FinalMatchCreate[] {
  return sortBracketPlan(plan);
}

/** 동일 이름의 라운드가 있으면 재사용(재생성·유지보수 후 재매칭), 없으면 생성 */
export async function getOrCreateTournamentRoundByName(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  name: string
) {
  const found = await tx.tournamentRound.findFirst({
    where: { tournamentId, name },
    orderBy: { sortOrder: "asc" },
  });
  if (found) return found;

  const agg = await tx.tournamentRound.aggregate({
    where: { tournamentId },
    _max: { sortOrder: true },
  });
  return tx.tournamentRound.create({
    data: {
      tournamentId,
      name,
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
      bracketData: null,
    },
  });
}

/** 경기장 슬롯 id 목록(정렬됨) — 생성 시 경기 순서대로 순환 배정 */
export async function fetchMatchVenueIdsOrdered(
  db: PrismaLike | Prisma.TransactionClient,
  tournamentId: string
): Promise<string[]> {
  const rows = await db.tournamentMatchVenue.findMany({
    where: { tournamentId },
    orderBy: [{ sortOrder: "asc" }, { venueNumber: "asc" }],
    select: { id: true },
  });
  return rows.map((r: { id: string }) => r.id);
}

/**
 * 정렬된 플랜으로 Match 행 생성 후 승자 진출 링크(nextMatchId / nextSlot) 설정.
 * @returns 생성된 match id 배열 (sortedPlan 순서와 동일)
 */
export async function createBracketMatchesFromPlan(
  tx: Prisma.TransactionClient,
  args: {
    tournamentId: string;
    tournamentRoundId: string | null;
    sortedPlan: FinalMatchCreate[];
    bracketPhase?: BracketPhase;
    /** 비어 있으면 경기장 미배정 */
    matchVenueIdsInOrder?: string[];
  }
): Promise<string[]> {
  const { tournamentId, sortedPlan, matchVenueIdsInOrder, bracketPhase } = args;
  const kind = bracketPhase === "PLAY_IN" ? "MAIN" : "MAIN";
  const result = await createBracketMatchesFromPlanByKind(tx, {
    tournamentId,
    kind,
    sortedPlan,
    matchVenueIdsInOrder,
  });
  return result.matchIds;
}
