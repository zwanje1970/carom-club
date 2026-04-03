/**
 * 본선/단판 Match 진행 상태 — READY, 승자 전파, 부전승 연쇄, 동기화.
 *
 * 레거시 이름은 유지하지만 내부 저장소는 `BracketMatch`다.
 */

import type { PrismaClient, BracketMatch } from "@/generated/prisma";

export async function fillNextWinnerSlot(
  db: PrismaClient,
  nextMatchId: string,
  slot: "A" | "B",
  winnerEntryId: string
): Promise<void> {
  const data = slot === "A" ? { entryIdA: winnerEntryId } : { entryIdB: winnerEntryId };
  await db.bracketMatch.update({
    where: { id: nextMatchId },
    data: data as Record<string, unknown>,
  });
}

/**
 * 양쪽 선수 배정 시 READY, 인원 부족 시 PENDING으로 되돌림.
 */
export async function refreshMatchProgressState(
  db: PrismaClient,
  tournamentId: string,
  matchId: string
): Promise<void> {
  const m = await db.bracketMatch.findFirst({
    where: { id: matchId, bracket: { tournamentId } },
  });
  if (!m) return;
  if (m.status === "COMPLETED" || m.isBye) return;

  const hasA = m.entryIdA != null && m.entryIdA !== "";
  const hasB = m.entryIdB != null && m.entryIdB !== "";

  if (!hasA || !hasB) {
    if (m.status === "READY" || m.status === "IN_PROGRESS") {
      await db.bracketMatch.update({
        where: { id: matchId },
        data: { status: "PENDING" },
      });
    }
    return;
  }

  if (m.status === "PENDING") {
    await db.bracketMatch.update({
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
  completed: BracketMatch
): Promise<void> {
  if (!completed.winnerEntryId || !completed.nextMatchId || !completed.nextSlot) return;

  const slot = completed.nextSlot as "A" | "B";
  await fillNextWinnerSlot(db, completed.nextMatchId, slot, completed.winnerEntryId);
  await refreshMatchProgressState(db, tournamentId, completed.nextMatchId);

  let cursor: string | null = completed.nextMatchId;
  for (let guard = 0; guard < 64; guard++) {
    if (!cursor) break;
    const m: BracketMatch | null = await db.bracketMatch.findFirst({
      where: { id: cursor, bracket: { tournamentId } },
    });
    if (!m) break;

    if (!m.isBye) break;

    const sole = m.entryIdA && !m.entryIdB ? m.entryIdA : !m.entryIdA && m.entryIdB ? m.entryIdB : null;
    if (!sole) break;

    await db.bracketMatch.update({
      where: { id: m.id },
      data: {
        winnerEntryId: sole,
        status: "COMPLETED",
        scoreA: m.entryIdA ? 1 : 0,
        scoreB: m.entryIdB ? 1 : 0,
        completedAt: new Date(),
      },
    });

    const u: BracketMatch | null = await db.bracketMatch.findUnique({
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
    const list = await db.bracketMatch.findMany({
      where: { bracket: { tournamentId } },
      orderBy: [{ round: { roundNumber: "asc" } }, { matchNumber: "asc" }],
    });

    let progressed = false;
    for (const m of list) {
      if (!m.isBye) continue;
      const sole = m.entryIdA && !m.entryIdB ? m.entryIdA : !m.entryIdA && m.entryIdB ? m.entryIdB : null;
      if (!sole) continue;

      await db.bracketMatch.update({
        where: { id: m.id },
        data: {
          winnerEntryId: sole,
          status: "COMPLETED",
          scoreA: m.entryIdA ? 1 : 0,
          scoreB: m.entryIdB ? 1 : 0,
          completedAt: new Date(),
        },
      });

      const u = await db.bracketMatch.findUnique({ where: { id: m.id } });
      if (u?.winnerEntryId && u.nextMatchId && u.nextSlot) {
        await onMatchCompletedWithWinner(db, tournamentId, u);
      }
      progressed = true;
    }

    for (const m of list) {
      await refreshMatchProgressState(db, tournamentId, m.id);
    }

    if (!progressed) break;
  }
}
