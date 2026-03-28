/**
 * 단판/본선 브래킷 — TournamentFinalMatch 관계형 저장 및 next 링크.
 * JSON blob이 아닌 Match 행이 운영 정본이며, 승자 진출은 nextMatchId/nextSlot + PATCH 로직과 연동.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { FinalMatchCreate } from "@/lib/final-bracket";

type PrismaLike = typeof prisma;

export type BracketPhase = "MAIN" | "QUALIFIER" | "PLAY_IN";

export function sortFinalBracketPlan(plan: FinalMatchCreate[]): FinalMatchCreate[] {
  return [...plan].sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex);
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
  const { tournamentId, tournamentRoundId, sortedPlan, bracketPhase = "MAIN" } = args;
  const venues = args.matchVenueIdsInOrder?.length ? args.matchVenueIdsInOrder : null;

  const createdIds: string[] = [];

  for (let i = 0; i < sortedPlan.length; i++) {
    const p = sortedPlan[i];
    const matchVenueId = venues ? venues[i % venues.length]! : null;

    const created = await tx.tournamentFinalMatch.create({
      data: {
        tournamentId,
        tournamentRoundId,
        matchVenueId,
        bracketPhase,
        roundIndex: p.roundIndex,
        matchIndex: p.matchIndex,
        entryIdA: p.entryIdA,
        entryIdB: p.entryIdB,
        status: p.status,
        nextMatchId: null,
        nextSlot: null,
      },
    });
    createdIds.push(created.id);
  }

  for (let i = 0; i < sortedPlan.length; i++) {
    const p = sortedPlan[i];
    const nextRound = p.roundIndex + 1;
    const nextMatchIndex = Math.floor(p.matchIndex / 2);
    const nextSlot = (p.matchIndex % 2 === 0 ? "A" : "B") as "A" | "B";
    const j = sortedPlan.findIndex((q) => q.roundIndex === nextRound && q.matchIndex === nextMatchIndex);
    if (j >= 0 && createdIds[j]) {
      await tx.tournamentFinalMatch.update({
        where: { id: createdIds[i] },
        data: { nextMatchId: createdIds[j], nextSlot },
      });
    }
  }

  return createdIds;
}
