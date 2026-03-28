import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientActiveOrgCanMutateTournaments } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getDisplayName } from "@/lib/display-name";

const ALLOWED_ENTRY_STATUSES = ["APPLIED", "CONFIRMED", "REJECTED", "CANCELED"] as const;
type EntryStatus = (typeof ALLOWED_ENTRY_STATUSES)[number];

function normalizeStatus(value: string | null): EntryStatus {
  return ALLOWED_ENTRY_STATUSES.includes(value as EntryStatus)
    ? (value as EntryStatus)
    : "CONFIRMED";
}

function maskPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return value;
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-****`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  if (digits.length >= 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  return value;
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }

  const session = await getSession();
  const gate = await assertClientActiveOrgCanMutateTournaments(session);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeStatus(searchParams.get("status"));
  const requestedTournamentIds = searchParams
    .getAll("tournamentId")
    .map((value) => value.trim())
    .filter(Boolean);

  const ownedTournaments = await prisma.tournament.findMany({
    where: { organizationId: gate.organizationId },
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      startAt: true,
    },
  });

  const ownedTournamentIds = new Set(ownedTournaments.map((t) => t.id));
  const hasForeignTournament = requestedTournamentIds.some((id) => !ownedTournamentIds.has(id));
  if (hasForeignTournament) {
    return NextResponse.json({ error: "현재 조직 소유 대회만 조회할 수 있습니다." }, { status: 403 });
  }

  const targetTournamentIds =
    requestedTournamentIds.length > 0
      ? requestedTournamentIds
      : ownedTournaments.map((t) => t.id);

  if (targetTournamentIds.length === 0) {
    return NextResponse.json({
      tournaments: [],
      recipients: [],
      filters: {
        status,
        selectedTournamentIds: [],
      },
    });
  }

  const entries = await prisma.tournamentEntry.findMany({
    where: {
      tournamentId: { in: targetTournamentIds },
      status,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      userId: true,
      createdAt: true,
      tournament: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          name: true,
          phone: true,
          status: true,
          withdrawnAt: true,
          pushSubscriptions: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      },
    },
  });

  const recipientsMap = new Map<
    string,
    {
      userId: string;
      name: string;
      phone: string | null;
      pushEnabled: boolean;
      tournaments: { id: string; name: string }[];
      tournamentCount: number;
      recentParticipationAt: string;
    }
  >();

  for (const entry of entries) {
    const current = recipientsMap.get(entry.userId);
    const tournamentRef = { id: entry.tournament.id, name: entry.tournament.name };
    if (!current) {
      recipientsMap.set(entry.userId, {
        userId: entry.userId,
        name: getDisplayName(entry.user),
        phone: maskPhone(entry.user.phone),
        pushEnabled: entry.user.pushSubscriptions.length > 0,
        tournaments: [tournamentRef],
        tournamentCount: 1,
        recentParticipationAt: entry.createdAt.toISOString(),
      });
      continue;
    }
    if (!current.tournaments.some((t) => t.id === tournamentRef.id)) {
      current.tournaments.push(tournamentRef);
      current.tournamentCount = current.tournaments.length;
    }
    if (new Date(entry.createdAt).getTime() > new Date(current.recentParticipationAt).getTime()) {
      current.recentParticipationAt = entry.createdAt.toISOString();
    }
    current.pushEnabled = current.pushEnabled || entry.user.pushSubscriptions.length > 0;
  }

  const recipients = [...recipientsMap.values()].sort(
    (a, b) =>
      new Date(b.recentParticipationAt).getTime() - new Date(a.recentParticipationAt).getTime()
  );

  return NextResponse.json({
    tournaments: ownedTournaments.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      startAt: t.startAt.toISOString(),
    })),
    recipients,
    filters: {
      status,
      selectedTournamentIds: targetTournamentIds,
    },
  });
}
