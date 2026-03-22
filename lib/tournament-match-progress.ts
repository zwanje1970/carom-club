/**
 * 본선/단판 Match 진행 상태 — READY, 승자 전파, 부전승 연쇄, 동기화.
 */

import type { PrismaClient, TournamentFinalMatch } from "@/generated/prisma";

export async function fillNextWinnerSlot(
  db: PrismaClient,
  nextMatchId: string,
  slot: "A" | "B",
  winnerEntryId: string
): Promise<void> {
  const data = slot === "A" ? { entryIdA: winnerEntryId } : { entryIdB: winnerEntryId };
  await db.tournamentFinalMatch.update({
    where: { id: nextMatchId },
    data: data as Record<string, unknown>,
  });
}

/**
 * 양쪽 선수 배정 시 READY, 인원 부족 시 PENDING으로 되돌림. COMPLETED/BYE/IN_PROGRESS는 유지(단, 진행 중 선수 빠짐은 PENDING).
 */
export async function refreshMatchProgressState(
  db: PrismaClient,
  tournamentId: string,
  matchId: string
): Promise<void> {
  const m = await db.tournamentFinalMatch.findFirst({
    where: { id: matchId, tournamentId },
  });
  if (!m) return;
  if (m.status === "COMPLETED") return;
  if (m.status === "BYE") return;

  const hasA = m.entryIdA != null && m.entryIdA !== "";
  const hasB = m.entryIdB != null && m.entryIdB !== "";

  if (!hasA || !hasB) {
    if (m.status === "READY" || m.status === "IN_PROGRESS") {
      await db.tournamentFinalMatch.update({
        where: { id: matchId },
        data: { status: "PENDING" },
      });
    }
    return;
  }

  if (m.status === "PENDING") {
    await db.tournamentFinalMatch.update({
      where: { id: matchId },
      data: { status: "READY" },
    });
  }
}

/**
 * 승자 확정(COMPLETED) 후 다음 슬롯 반영 + 부전승 연쇄 처리 + 다음 경기 READY 갱신.
 */
export async function onMatchCompletedWithWinner(
  db: PrismaClient,
  tournamentId: string,
  completed: TournamentFinalMatch
): Promise<void> {
  if (!completed.winnerEntryId || !completed.nextMatchId || !completed.nextSlot) return;

  const slot = completed.nextSlot as "A" | "B";
  await fillNextWinnerSlot(db, completed.nextMatchId, slot, completed.winnerEntryId);
  await refreshMatchProgressState(db, tournamentId, completed.nextMatchId);

  let cursor: string | null = completed.nextMatchId;
  for (let guard = 0; guard < 64; guard++) {
    if (!cursor) break;
    const m: TournamentFinalMatch | null = await db.tournamentFinalMatch.findFirst({
      where: { id: cursor, tournamentId },
    });
    if (!m) break;

    if (m.status !== "BYE") break;

    const sole =
      m.entryIdA && !m.entryIdB ? m.entryIdA : !m.entryIdA && m.entryIdB ? m.entryIdB : null;
    if (!sole) break;

    await db.tournamentFinalMatch.update({
      where: { id: m.id },
      data: {
        winnerEntryId: sole,
        status: "COMPLETED",
        scoreA: m.entryIdA ? 1 : 0,
        scoreB: m.entryIdB ? 1 : 0,
      } as Record<string, unknown>,
    });

    const u: TournamentFinalMatch | null = await db.tournamentFinalMatch.findUnique({
      where: { id: m.id },
    });
    if (!u?.winnerEntryId || !u.nextMatchId || !u.nextSlot) {
      break;
    }
    const ns = u.nextSlot as "A" | "B";
    await fillNextWinnerSlot(db, u.nextMatchId, ns, u.winnerEntryId);
    await refreshMatchProgressState(db, tournamentId, u.nextMatchId);
    cursor = u.nextMatchId;
  }
}

/**
 * 대진 생성 직후·수동 동기화: 부전승 자동 완료(연쇄) + 전 경기 READY/PENDING 정리.
 */
export async function syncBracketMatchProgressStates(
  db: PrismaClient,
  tournamentId: string
): Promise<void> {
  for (let pass = 0; pass < 12; pass++) {
    const list = await db.tournamentFinalMatch.findMany({
      where: { tournamentId },
      orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
    });

    let progressed = false;
    for (const m of list) {
      if (m.status !== "BYE") continue;
      const sole =
        m.entryIdA && !m.entryIdB ? m.entryIdA : !m.entryIdA && m.entryIdB ? m.entryIdB : null;
      if (!sole) continue;

      await db.tournamentFinalMatch.update({
        where: { id: m.id },
        data: {
          winnerEntryId: sole,
          status: "COMPLETED",
          scoreA: m.entryIdA ? 1 : 0,
          scoreB: m.entryIdB ? 1 : 0,
        } as Record<string, unknown>,
      });

      const u = await db.tournamentFinalMatch.findUnique({ where: { id: m.id } });
      if (u?.winnerEntryId && u.nextMatchId && u.nextSlot) {
        await onMatchCompletedWithWinner(db, tournamentId, u);
      }
      progressed = true;
    }

    for (const m of await db.tournamentFinalMatch.findMany({ where: { tournamentId } })) {
      await refreshMatchProgressState(db, tournamentId, m.id);
    }

    if (!progressed) break;
  }
}
