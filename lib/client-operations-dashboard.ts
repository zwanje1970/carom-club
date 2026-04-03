import { prisma } from "@/lib/db";
import { getKstYmd } from "@/lib/kst-date";

export type ClientDashboardData = {
  stats: {
    activeTournaments: number;
    pendingEntryApprovals: number;
    bracketIncompleteLocked: number;
    settlementPendingFinished: number;
  };
  todayTournaments: { id: string; name: string; startAt: Date; status: string }[];
  todayMatches: {
    id: string;
    tournamentId: string;
    tournamentName: string;
    roundIndex: number;
    matchIndex: number;
    status: string;
    scheduledStartAt: Date | null;
  }[];
  pendingTasks: { kind: string; label: string; href: string; count?: number }[];
  recentTournaments: { id: string; name: string; status: string; updatedAt: Date }[];
  recentAudit: {
    at: Date;
    tournamentName: string;
    action: string;
    matchId: string;
  }[];
  alerts: { level: "info" | "warn"; text: string }[];
};

export async function loadClientOperationsDashboard(orgId: string): Promise<ClientDashboardData> {
  const todayKst = getKstYmd(new Date());

  const [
    activeTournaments,
    pendingEntryApprovals,
    bracketIncompleteLocked,
    settlementPendingRows,
    tournamentsForToday,
    recentTournaments,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.tournament.count({
      where: {
        organizationId: orgId,
        status: { in: ["OPEN", "CLOSED", "BRACKET_GENERATED"] },
      },
    }),
    prisma.tournamentEntry.count({
      where: { tournament: { organizationId: orgId }, status: "APPLIED" },
    }),
    prisma.tournament.count({
      where: {
        organizationId: orgId,
        participantRosterLockedAt: { not: null },
        brackets: { none: { kind: "MAIN" } },
        status: { notIn: ["DRAFT", "HIDDEN", "FINISHED"] },
      },
    }),
    prisma.tournament.findMany({
      where: {
        organizationId: orgId,
        status: "FINISHED",
        OR: [{ settlement: null }, { settlement: { status: "DRAFT" } }],
      },
      select: { id: true },
    }),
    prisma.tournament.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, startAt: true, status: true },
      orderBy: { startAt: "asc" },
      take: 80,
    }),
    prisma.tournament.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, name: true, status: true, updatedAt: true },
    }),
    prisma.bracketAuditLog.findMany({
      where: { tournament: { organizationId: orgId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        createdAt: true,
        actionType: true,
        matchId: true,
        tournament: { select: { name: true } },
      },
    }),
  ]);

  const settlementPendingFinished = settlementPendingRows.length;

  const todayTournaments = tournamentsForToday.filter(
    (t) => getKstYmd(new Date(t.startAt)) === todayKst
  );

  const todayMatchRows = await prisma.bracketMatch.findMany({
    where: {
      bracket: { tournament: { organizationId: orgId }, kind: "MAIN" },
      scheduledStartAt: {
        gte: new Date(`${todayKst}T00:00:00+09:00`),
        lt: new Date(`${todayKst}T23:59:59.999+09:00`),
      },
    },
    orderBy: [{ scheduledStartAt: "asc" }],
    take: 20,
    select: {
      id: true,
      bracket: { select: { tournamentId: true, tournament: { select: { name: true } } } },
      round: { select: { roundNumber: true } },
      matchNumber: true,
      status: true,
      scheduledStartAt: true,
    },
  });

  const todayMatches = todayMatchRows.map((m) => ({
    id: m.id,
    tournamentId: m.bracket.tournamentId,
    tournamentName: m.bracket.tournament.name,
    roundIndex: m.round.roundNumber,
    matchIndex: m.matchNumber,
    status: m.status,
    scheduledStartAt: m.scheduledStartAt,
  }));

  const pendingTasks: ClientDashboardData["pendingTasks"] = [];
  if (pendingEntryApprovals > 0) {
    pendingTasks.push({
      kind: "entries",
      label: "참가 승인 대기",
      href: "/client/operations",
      count: pendingEntryApprovals,
    });
  }
  if (bracketIncompleteLocked > 0) {
    pendingTasks.push({
      kind: "bracket",
      label: "명단 확정 후 대진 미생성",
      href: "/client/operations",
      count: bracketIncompleteLocked,
    });
  }
  if (settlementPendingFinished > 0) {
    pendingTasks.push({
      kind: "settlement",
      label: "종료 대회 정산 미완료",
      href: "/client/billing",
      count: settlementPendingFinished,
    });
  }

  const alerts: ClientDashboardData["alerts"] = [];
  if (pendingEntryApprovals > 0) {
    alerts.push({
      level: "warn",
      text: `승인 대기 참가 신청 ${pendingEntryApprovals}건이 있습니다.`,
    });
  }
  if (bracketIncompleteLocked > 0) {
    alerts.push({
      level: "warn",
      text: `참가 명단이 확정되었으나 본선 대진이 없는 대회 ${bracketIncompleteLocked}건입니다.`,
    });
  }
  if (settlementPendingFinished > 0) {
    alerts.push({
      level: "info",
      text: `종료된 대회 중 정산 초안·미입력 ${settlementPendingFinished}건입니다.`,
    });
  }

  return {
    stats: {
      activeTournaments,
      pendingEntryApprovals,
      bracketIncompleteLocked,
      settlementPendingFinished,
    },
    todayTournaments,
    todayMatches,
    pendingTasks,
    recentTournaments,
    recentAudit: recentAuditLogs.map((a) => ({
      at: a.createdAt,
      tournamentName: a.tournament.name,
      action: a.actionType,
      matchId: a.matchId ?? "",
    })),
    alerts,
  };
}
