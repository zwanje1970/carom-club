import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { buildRoundRobinPlan, calculateLeagueStandings } from "@/lib/league-engine";

type LeagueKind = "MAIN" | "ZONE" | "FINAL";
type LeagueTieBreaker = "HEAD_TO_HEAD" | "SCORE_DIFF" | "SCORE_FOR" | "DRAW_COUNT";
type LeagueMatchStatus = "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type LeagueCreateInput = {
  tournamentId: string;
  kind: LeagueKind;
  zoneId?: string | null;
  matchDayId?: string | null;
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  tieBreaker?: LeagueTieBreaker;
  seedFromConfirmedEntries?: boolean;
  actorUserId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
};

export type LeagueMatchResultInput = {
  scoreA: number;
  scoreB: number;
  winnerLeagueEntryId?: string | null;
  status?: LeagueMatchStatus;
  note?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
};

function normalizeLeagueKind(kind: LeagueKind): LeagueKind {
  return kind;
}

async function findTargetLeaguesForTournamentEntry(args: {
  tournamentId: string;
  zoneId?: string | null;
}) {
  const orClauses: Prisma.LeagueWhereInput[] = [{ kind: "MAIN" }];
  if (args.zoneId) {
    orClauses.push({ kind: "ZONE", zoneId: args.zoneId });
  }
  const leagues = await prisma.league.findMany({
    where: {
      tournamentId: args.tournamentId,
      status: { not: "CANCELLED" },
      OR: orClauses,
    },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
  return leagues;
}

async function loadLeagueEntries(tx: Prisma.TransactionClient, leagueId: string) {
  return tx.leagueEntry.findMany({
    where: { leagueId, status: "ACTIVE" },
    orderBy: [
      { sortOrder: "asc" },
      { seedNumber: "asc" },
      { registeredAt: "asc" },
      { id: "asc" },
    ],
  });
}

async function recalculateLeagueStandingsInTx(
  tx: Prisma.TransactionClient,
  leagueId: string
): Promise<number> {
  const league = await tx.league.findUnique({
    where: { id: leagueId },
    include: {
      entries: {
        where: { status: "ACTIVE" },
        orderBy: [
          { sortOrder: "asc" },
          { seedNumber: "asc" },
          { registeredAt: "asc" },
          { id: "asc" },
        ],
      },
      matches: {
        orderBy: [{ roundId: "asc" }, { matchNumber: "asc" }],
        include: {
          leagueEntryA: true,
          leagueEntryB: true,
          winnerLeagueEntry: true,
        },
      },
    },
  });
  if (!league) return 0;

  const standings = calculateLeagueStandings({
    entries: league.entries.map((entry) => ({
      entryId: entry.tournamentEntryId,
      displayName: entry.displayName,
      levelCode: entry.levelCode,
    })),
    matches: league.matches.map((match) => ({
      entryIdA: match.leagueEntryIdA,
      entryIdB: match.leagueEntryIdB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: match.status,
      isForcedZeroPoint: match.isForcedZeroPoint,
    })),
    pointsForWin: league.pointsForWin,
    pointsForDraw: league.pointsForDraw,
    pointsForLoss: league.pointsForLoss,
  });

  const leagueEntryById = new Map(league.entries.map((entry) => [entry.id, entry]));
  for (let index = 0; index < standings.length; index++) {
    const row = standings[index]!;
    const leagueEntry = leagueEntryById.get(row.entryId);
    if (!leagueEntry) continue;
    await tx.leagueStanding.upsert({
      where: {
        leagueId_entryId: {
          leagueId,
          entryId: leagueEntry.tournamentEntryId,
        },
      },
      create: {
        leagueId,
        entryId: leagueEntry.tournamentEntryId,
        leagueEntryId: leagueEntry.id,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        points: row.points,
        scoreFor: row.scoreFor,
        scoreAgainst: row.scoreAgainst,
        scoreDiff: row.scoreDiff,
        rank: index + 1,
      },
      update: {
        leagueEntryId: leagueEntry.id,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        points: row.points,
        scoreFor: row.scoreFor,
        scoreAgainst: row.scoreAgainst,
        scoreDiff: row.scoreDiff,
        rank: index + 1,
      },
    });
  }

  return standings.length;
}

async function syncLeagueLifecycleStatusInTx(tx: Prisma.TransactionClient, leagueId: string) {
  const league = await tx.league.findUnique({
    where: { id: leagueId },
    select: {
      status: true,
      matches: {
        select: {
          status: true,
          isWalkover: true,
        },
      },
    },
  });
  if (!league) return;

  const relevantMatches = league.matches.filter((match) => !match.isWalkover);
  if (relevantMatches.length === 0) {
    if (league.status !== "DRAFT") {
      await tx.league.update({
        where: { id: leagueId },
        data: { status: "COMPLETED" },
      });
    }
    return;
  }

  const completedCount = relevantMatches.filter((match) => match.status === "COMPLETED").length;
  const nextStatus =
    completedCount === relevantMatches.length
      ? "COMPLETED"
      : completedCount > 0
        ? "IN_PROGRESS"
        : league.status;

  if (nextStatus !== league.status) {
    await tx.league.update({
      where: { id: leagueId },
      data: { status: nextStatus },
    });
  }
}

async function completeRemainingLeagueMatchesInTx(
  tx: Prisma.TransactionClient,
  leagueId: string
): Promise<{ forcedCount: number }> {
  const now = new Date();
  const remainingMatches = await tx.leagueMatch.findMany({
    where: {
      leagueId,
      status: { in: ["PENDING", "READY", "IN_PROGRESS"] },
    },
    orderBy: [{ roundId: "asc" }, { matchNumber: "asc" }],
  });

  if (remainingMatches.length === 0) {
    return { forcedCount: 0 };
  }

  for (const match of remainingMatches) {
    await tx.leagueMatch.update({
      where: { id: match.id },
      data: {
        scoreA: 0,
        scoreB: 0,
        winnerLeagueEntryId: null,
        status: "COMPLETED",
        isForcedZeroPoint: true,
        completedAt: now,
        startedAt: match.startedAt ?? now,
      },
    });
  }

  return { forcedCount: remainingMatches.length };
}

async function rebuildLeagueScheduleInTx(tx: Prisma.TransactionClient, leagueId: string): Promise<{
  roundCount: number;
  matchCount: number;
  activeEntryCount: number;
}> {
  const league = await tx.league.findUnique({
    where: { id: leagueId },
    include: {
      entries: {
        where: { status: "ACTIVE" },
        orderBy: [
          { sortOrder: "asc" },
          { seedNumber: "asc" },
          { registeredAt: "asc" },
          { id: "asc" },
        ],
      },
    },
  });
  if (!league) {
    return { roundCount: 0, matchCount: 0, activeEntryCount: 0 };
  }

  await tx.leagueMatch.deleteMany({ where: { leagueId } });
  await tx.leagueRound.deleteMany({ where: { leagueId } });
  await tx.leagueStanding.deleteMany({ where: { leagueId } });

  const activeEntries = league.entries;
  if (activeEntries.length === 0) {
    await tx.league.update({
      where: { id: leagueId },
      data: { status: "DRAFT", generatedAt: null },
    });
    return { roundCount: 0, matchCount: 0, activeEntryCount: 0 };
  }

  const plan = buildRoundRobinPlan(
    activeEntries.map((entry) => ({
      entryId: entry.id,
      displayName: entry.displayName,
      levelCode: entry.levelCode,
    }))
  );

  const roundMap = new Map<number, string>();
  const roundNumbers = Array.from(new Set(plan.map((row) => row.roundNumber))).sort((a, b) => a - b);
  for (const roundNumber of roundNumbers) {
    const roundRows = plan.filter((row) => row.roundNumber === roundNumber);
    const round = await tx.leagueRound.create({
      data: {
        leagueId,
        roundNumber: roundNumber + 1,
        name: `${roundNumber + 1}라운드`,
        sortOrder: roundNumber,
      },
    });
    roundMap.set(roundNumber, round.id);
  }

  let matchCount = 0;
  for (const row of plan) {
    const roundId = roundMap.get(row.roundNumber);
    const entryA = activeEntries.find((entry) => entry.id === row.entryIdA) ?? null;
    const entryB = activeEntries.find((entry) => entry.id === row.entryIdB) ?? null;
    if (!roundId) continue;
    await tx.leagueMatch.create({
      data: {
        leagueId,
        roundId,
        matchNumber: row.matchNumber,
        entryIdA: entryA?.tournamentEntryId ?? null,
        entryIdB: entryB?.tournamentEntryId ?? null,
        leagueEntryIdA: entryA?.id ?? null,
        leagueEntryIdB: entryB?.id ?? null,
        winnerLeagueEntryId: null,
        status: row.isWalkover ? "READY" : row.status,
        isWalkover: row.isWalkover,
        isManualOverride: false,
      },
    });
    matchCount += 1;
  }

  await recalculateLeagueStandingsInTx(tx, leagueId);
  await tx.league.update({
    where: { id: leagueId },
    data: {
      status: matchCount === 0 ? "COMPLETED" : "GENERATED",
      generatedAt: new Date(),
    },
  });

  return {
    roundCount: roundNumbers.length,
    matchCount,
    activeEntryCount: activeEntries.length,
  };
}

async function upsertLeagueEntryInTx(args: {
  tx: Prisma.TransactionClient;
  leagueId: string;
  tournamentEntryId: string;
  displayName: string;
  levelCode?: string | null;
  seedNumber?: number | null;
  sortOrder?: number;
}) {
  const { tx, leagueId, tournamentEntryId } = args;
  const existing = await tx.leagueEntry.findUnique({
    where: {
      leagueId_tournamentEntryId: {
        leagueId,
        tournamentEntryId,
      },
    },
  });
  if (existing) {
    return tx.leagueEntry.update({
      where: { id: existing.id },
      data: {
        displayName: args.displayName,
        levelCode: args.levelCode ?? null,
        seedNumber: args.seedNumber ?? null,
        sortOrder: args.sortOrder ?? existing.sortOrder,
        status: "ACTIVE",
        withdrawnAt: null,
      },
    });
  }
  return tx.leagueEntry.create({
    data: {
      leagueId,
      tournamentEntryId,
      displayName: args.displayName,
      levelCode: args.levelCode ?? null,
      seedNumber: args.seedNumber ?? null,
      sortOrder: args.sortOrder ?? 0,
      status: "ACTIVE",
      isAutoRegistered: true,
    },
  });
}

async function withdrawLeagueEntryInTx(args: {
  tx: Prisma.TransactionClient;
  leagueId: string;
  tournamentEntryId: string;
  status?: "WITHDRAWN" | "EXCLUDED";
}) {
  const existing = await args.tx.leagueEntry.findUnique({
    where: {
      leagueId_tournamentEntryId: {
        leagueId: args.leagueId,
        tournamentEntryId: args.tournamentEntryId,
      },
    },
  });
  if (!existing) return null;
  return args.tx.leagueEntry.update({
    where: { id: existing.id },
    data: {
      status: args.status ?? "WITHDRAWN",
      withdrawnAt: new Date(),
    },
  });
}

export async function createOrRebuildLeagueFromTournament(args: LeagueCreateInput) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: args.tournamentId },
    select: { id: true },
  });
  if (!tournament) {
    return { ok: false as const, status: 404, error: "대회를 찾을 수 없습니다." };
  }

  const kind = normalizeLeagueKind(args.kind);
  const seedFromConfirmedEntries = args.seedFromConfirmedEntries !== false;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.league.findFirst({
      where: {
        tournamentId: args.tournamentId,
        kind,
        zoneId: args.zoneId ?? null,
      },
      select: { id: true },
    });
    if (existing) {
      await tx.league.delete({ where: { id: existing.id } });
    }

    const league = await tx.league.create({
      data: {
        tournamentId: args.tournamentId,
        zoneId: args.zoneId ?? null,
        kind,
        status: "DRAFT",
        pointsForWin: args.pointsForWin ?? 3,
        pointsForDraw: args.pointsForDraw ?? 1,
        pointsForLoss: args.pointsForLoss ?? 0,
        tieBreaker: args.tieBreaker ?? "HEAD_TO_HEAD",
        generatedAt: null,
      },
    });

    if (!seedFromConfirmedEntries) {
      return {
        ok: true as const,
        leagueId: league.id,
        roundCount: 0,
        matchCount: 0,
        entryCount: 0,
      };
    }

    const entries = await tx.tournamentEntry.findMany({
      where: {
        tournamentId: args.tournamentId,
        status: "CONFIRMED",
        ...(kind === "ZONE" && args.zoneId ? { zoneId: args.zoneId } : {}),
      },
      include: { user: { select: { name: true } } },
      orderBy: [
        { seedNumber: "asc" },
        { bracketOrder: "asc" },
        { levelCode: "asc" },
        { id: "asc" },
      ],
    });

    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!;
      await upsertLeagueEntryInTx({
        tx,
        leagueId: league.id,
        tournamentEntryId: entry.id,
        displayName: entry.displayName ?? entry.user?.name ?? entry.userId ?? entry.id,
        levelCode: entry.levelCode,
        seedNumber: entry.seedNumber,
        sortOrder: index,
      });
    }

    const schedule = await rebuildLeagueScheduleInTx(tx, league.id);

    if (args.actorUserId && args.actorRole) {
      await tx.leagueAuditLog.create({
        data: {
          tournamentId: args.tournamentId,
          leagueId: league.id,
          actorUserId: args.actorUserId,
          actorRole: args.actorRole,
          actionType: "LEAGUE_CREATED",
          beforeJson: null,
          afterJson: JSON.stringify({
            kind,
            zoneId: args.zoneId ?? null,
            entryCount: entries.length,
            schedule,
          }),
          reason: args.reason ?? null,
        },
      });
    }

    return {
      ok: true as const,
      leagueId: league.id,
      roundCount: schedule.roundCount,
      matchCount: schedule.matchCount,
      entryCount: entries.length,
    };
  });
}

export async function syncLeagueEntriesForTournamentEntry(args: {
  tournamentId: string;
  tournamentEntryId: string;
  nextStatus: "APPLIED" | "CONFIRMED" | "CANCELED" | "REJECTED";
  actorUserId?: string | null;
  actorRole?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.tournamentEntry.findUnique({
      where: { id: args.tournamentEntryId },
      include: { user: { select: { name: true } } },
    });
    if (!entry || entry.tournamentId !== args.tournamentId) {
      return { ok: false as const, updated: 0, rebuilt: 0 };
    }

    const leagues = await findTargetLeaguesForTournamentEntry({
      tournamentId: args.tournamentId,
      zoneId: entry.zoneId,
    });

    let updated = 0;
    let rebuilt = 0;

    for (const league of leagues) {
      if (league.kind === "FINAL") continue;
      if (args.nextStatus === "CONFIRMED") {
        await upsertLeagueEntryInTx({
          tx,
          leagueId: league.id,
          tournamentEntryId: entry.id,
          displayName: entry.displayName ?? entry.user?.name ?? entry.userId ?? entry.id,
          levelCode: entry.levelCode,
          seedNumber: entry.seedNumber,
          sortOrder: entry.seedNumber ?? 0,
        });
        updated += 1;

        const completedMatchCount = await tx.leagueMatch.count({
          where: { leagueId: league.id, status: "COMPLETED" },
        });
        if (league.status !== "COMPLETED" && completedMatchCount === 0) {
          const schedule = await rebuildLeagueScheduleInTx(tx, league.id);
          rebuilt += schedule.matchCount > 0 ? 1 : 0;
        } else {
          await recalculateLeagueStandingsInTx(tx, league.id);
        }
      } else {
        await withdrawLeagueEntryInTx({
          tx,
          leagueId: league.id,
          tournamentEntryId: entry.id,
          status: args.nextStatus === "REJECTED" ? "EXCLUDED" : "WITHDRAWN",
        });
        updated += 1;
        await recalculateLeagueStandingsInTx(tx, league.id);
      }
    }

    if (updated > 0 && args.actorUserId && args.actorRole) {
      await tx.leagueAuditLog.createMany({
        data: leagues
          .filter((league) => league.kind !== "FINAL")
          .map((league) => ({
            tournamentId: args.tournamentId,
            leagueId: league.id,
            actorUserId: args.actorUserId!,
            actorRole: args.actorRole!,
            actionType:
              args.nextStatus === "CONFIRMED"
                ? "LEAGUE_ENTRY_REGISTERED"
                : args.nextStatus === "REJECTED"
                  ? "LEAGUE_ENTRY_EXCLUDED"
                  : "LEAGUE_ENTRY_WITHDRAWN",
            beforeJson: null,
            afterJson: JSON.stringify({
              tournamentEntryId: entry.id,
              nextStatus: args.nextStatus,
            }),
            reason: null,
          })),
      });
    }

    return { ok: true as const, updated, rebuilt };
  });
}

export async function getLeagueDetail(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      entries: {
        orderBy: [
          { sortOrder: "asc" },
          { seedNumber: "asc" },
          { registeredAt: "asc" },
          { id: "asc" },
        ],
      },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { matches: { orderBy: { matchNumber: "asc" } } },
      },
      matches: {
        orderBy: [{ roundId: "asc" }, { matchNumber: "asc" }],
        include: {
          leagueEntryA: true,
          leagueEntryB: true,
          winnerLeagueEntry: true,
        },
      },
      standings: {
        orderBy: [{ rank: "asc" }, { points: "desc" }, { scoreDiff: "desc" }, { scoreFor: "desc" }],
        include: { leagueEntry: true },
      },
    },
  });
}

export async function recalculateLeagueStandingsByLeagueId(
  leagueId: string,
  actor?: { userId: string; role: string; reason?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    const league = await tx.league.findUnique({
      where: { id: leagueId },
      select: { tournamentId: true, status: true },
    });
    if (!league) {
      return { ok: false as const, status: 404, error: "리그를 찾을 수 없습니다." };
    }
    if (league.status === "COMPLETED") {
      return { ok: false as const, status: 409, error: "이미 종료된 리그입니다." };
    }

    const count = await recalculateLeagueStandingsInTx(tx, leagueId);
    if (actor) {
      await tx.leagueAuditLog.create({
        data: {
          tournamentId: league.tournamentId,
          leagueId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          actionType: "LEAGUE_STANDINGS_RECALCULATED",
          beforeJson: null,
          afterJson: JSON.stringify({ standingsCount: count }),
          reason: actor.reason ?? null,
        },
      });
    }
    return { ok: true as const, standingsCount: count };
  });
}

export async function forceCompleteLeagueByLeagueId(
  leagueId: string,
  actor?: { userId: string; role: string; reason?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    const league = await tx.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        tournamentId: true,
        status: true,
        completedAt: true,
      },
    });
    if (!league) {
      return { ok: false as const, status: 404, error: "리그를 찾을 수 없습니다." };
    }

    if (league.status === "COMPLETED") {
      const standingsCount = await tx.leagueStanding.count({ where: { leagueId } });
      return { ok: true as const, standingsCount, forcedMatchCount: 0 };
    }

    const forced = await completeRemainingLeagueMatchesInTx(tx, leagueId);
    const standingsCount = await recalculateLeagueStandingsInTx(tx, leagueId);
    await tx.league.update({
      where: { id: leagueId },
      data: {
        status: "COMPLETED",
        completedAt: league.completedAt ?? new Date(),
      },
    });

    if (actor) {
      await tx.leagueAuditLog.create({
        data: {
          tournamentId: league.tournamentId,
          leagueId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          actionType: "LEAGUE_FORCE_COMPLETED",
          beforeJson: JSON.stringify({
            status: league.status,
            completedAt: league.completedAt,
          }),
          afterJson: JSON.stringify({
            forcedMatchCount: forced.forcedCount,
            standingsCount,
          }),
          reason: actor.reason ?? null,
        },
      });
    }

    return { ok: true as const, standingsCount, forcedMatchCount: forced.forcedCount };
  });
}

export async function patchLeagueMatchResult(args: {
  leagueId: string;
  matchId: string;
  scoreA: number;
  scoreB: number;
  winnerLeagueEntryId?: string | null;
  status?: LeagueMatchStatus;
  note?: string | null;
  actorUserId: string;
  actorRole: string;
  reason?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const league = await tx.league.findUnique({
      where: { id: args.leagueId },
      include: {
        entries: true,
        matches: true,
      },
    });
    if (!league) {
      return { ok: false as const, status: 404, error: "리그를 찾을 수 없습니다." };
    }
    if (league.status === "COMPLETED") {
      return { ok: false as const, status: 409, error: "이미 종료된 리그는 수정할 수 없습니다." };
    }

    const match = await tx.leagueMatch.findFirst({
      where: { id: args.matchId, leagueId: args.leagueId },
    });
    if (!match) {
      return { ok: false as const, status: 404, error: "경기를 찾을 수 없습니다." };
    }

    if (match.entryIdA == null && match.entryIdB == null) {
      return { ok: false as const, status: 400, error: "참가자가 배정되지 않은 경기입니다." };
    }

    const nextStatus: LeagueMatchStatus = args.status ?? "COMPLETED";
    const computedWinner =
      args.winnerLeagueEntryId ??
      (args.scoreA > args.scoreB
        ? match.leagueEntryIdA
        : args.scoreB > args.scoreA
          ? match.leagueEntryIdB
          : null);

    if (
      computedWinner != null &&
      computedWinner !== match.leagueEntryIdA &&
      computedWinner !== match.leagueEntryIdB
    ) {
      return { ok: false as const, status: 400, error: "winnerLeagueEntryId가 경기 참가자가 아닙니다." };
    }

    await tx.leagueMatch.update({
      where: { id: match.id },
      data: {
        scoreA: args.scoreA,
        scoreB: args.scoreB,
        winnerLeagueEntryId: computedWinner,
        status: nextStatus,
        note: args.note ?? match.note,
        completedAt: nextStatus === "COMPLETED" ? new Date() : null,
        startedAt: match.startedAt ?? (nextStatus === "COMPLETED" ? new Date() : null),
      },
    });

    const standings = await recalculateLeagueStandingsInTx(tx, args.leagueId);
    await syncLeagueLifecycleStatusInTx(tx, args.leagueId);

    await tx.leagueAuditLog.create({
      data: {
        tournamentId: league.tournamentId,
        leagueId: league.id,
        matchId: match.id,
        actorUserId: args.actorUserId,
        actorRole: args.actorRole,
        actionType: "LEAGUE_MATCH_RESULT_UPDATED",
        beforeJson: JSON.stringify({
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          winnerLeagueEntryId: match.winnerLeagueEntryId,
          status: match.status,
        }),
        afterJson: JSON.stringify({
          scoreA: args.scoreA,
          scoreB: args.scoreB,
          winnerLeagueEntryId: computedWinner,
          status: nextStatus,
          standings,
        }),
        reason: args.reason ?? null,
      },
    });

    return { ok: true as const, standingsCount: standings };
  });
}

