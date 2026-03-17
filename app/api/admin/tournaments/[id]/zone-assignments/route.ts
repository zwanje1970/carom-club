import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament, canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";

/** 대회 기준: 전체 참가자, 미배정, 권역별 배정 현황. ?tournamentZoneId= 시 해당 권역 참가자만. GET → canViewTournament */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId } = await params;
  const { searchParams } = new URL(request.url);
  const filterZoneId = searchParams.get("tournamentZoneId")?.trim() || null;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 볼 권한이 없습니다." }, { status: 403 });
  }

  const [entries, assignments, tournamentZones] = await Promise.all([
    prisma.tournamentEntry.findMany({
      where: {
        tournamentId,
        ...(filterZoneId
          ? { zoneAssignment: { tournamentZoneId: filterZoneId } }
          : {}),
      },
      orderBy: [{ status: "asc" }, { waitingListOrder: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, name: true }, include: { memberProfile: { select: { handicap: true, avg: true } } } },
        zoneAssignment: {
          include: {
            tournamentZone: {
              include: { zone: { select: { id: true, name: true, code: true } } },
            },
          },
        },
      },
    }),
    prisma.tournamentEntryZoneAssignment.findMany({
      where: { entry: { tournamentId } },
      include: {
        tournamentZone: { include: { zone: { select: { name: true, code: true } } } },
        entry: { select: { id: true, userId: true } },
      },
    }),
    prisma.tournamentZone.findMany({
      where: { tournamentId },
      orderBy: { sortOrder: "asc" },
      include: { zone: { select: { id: true, name: true, code: true } } },
    }),
  ]);

  const unassignedCount = entries.filter((e) => !e.zoneAssignment).length;
  const zoneCounts: { tournamentZoneId: string; zoneName: string; zoneCode: string | null; count: number }[] = tournamentZones.map((tz) => ({
    tournamentZoneId: tz.id,
    zoneName: tz.name ?? tz.zone.name,
    zoneCode: tz.code ?? tz.zone.code,
    count: assignments.filter((a) => a.tournamentZoneId === tz.id).length,
  }));

  return NextResponse.json({
    tournamentId,
    entries: entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      userName: e.user.name,
      handicap: e.user.memberProfile?.handicap ?? null,
      avg: e.user.memberProfile?.avg ?? null,
      status: e.status,
      zoneAssignment: e.zoneAssignment
        ? {
            id: e.zoneAssignment.id,
            tournamentZoneId: e.zoneAssignment.tournamentZoneId,
            zoneName: e.zoneAssignment.tournamentZone.name ?? e.zoneAssignment.tournamentZone.zone.name,
            zoneCode: e.zoneAssignment.tournamentZone.zone.code,
            assignmentType: e.zoneAssignment.assignmentType,
            assignedAt: e.zoneAssignment.assignedAt.toISOString(),
            notes: e.zoneAssignment.notes,
          }
        : null,
    })),
    tournamentZones: tournamentZones.map((tz) => ({
      id: tz.id,
      name: tz.name ?? tz.zone.name,
      code: tz.code ?? tz.zone.code,
      zoneId: tz.zoneId,
    })),
    unassignedCount,
    zoneCounts,
  });
}

/** 수동 배정. POST → canManageTournament. body: entryId, tournamentZoneId, assignmentType?, notes? */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }
  if (isQualifierLocked(tournament.tournamentStage)) {
    return NextResponse.json(
      { error: "본선 준비가 완료된 후에는 권역 참가자 배정을 변경할 수 없습니다." },
      { status: 409 }
    );
  }

  let body: { entryId?: string; tournamentZoneId?: string; assignmentType?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const entryId = typeof body?.entryId === "string" ? body.entryId.trim() : "";
  const tournamentZoneId = typeof body?.tournamentZoneId === "string" ? body.tournamentZoneId.trim() : "";
  if (!entryId || !tournamentZoneId) {
    return NextResponse.json({ error: "entryId, tournamentZoneId가 필요합니다." }, { status: 400 });
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tournamentZoneId, tournamentId },
  });
  if (!tz) return NextResponse.json({ error: "해당 대회의 권역을 찾을 수 없습니다." }, { status: 404 });

  const existing = await prisma.tournamentEntryZoneAssignment.findUnique({
    where: { tournamentEntryId: entryId },
  });
  if (existing) {
    const updated = await prisma.tournamentEntryZoneAssignment.update({
      where: { id: existing.id },
      data: {
        tournamentZoneId,
        assignmentType: body.assignmentType === "AUTO" ? "AUTO" : "MANUAL",
        assignedAt: new Date(),
        assignedByUserId: session.id,
        notes: typeof body?.notes === "string" ? body.notes.trim() || null : existing.notes,
      },
      include: {
        tournamentZone: { include: { zone: { select: { name: true, code: true } } } },
      },
    });
    return NextResponse.json(updated);
  }

  const assignmentType = body.assignmentType === "AUTO" ? "AUTO" : "MANUAL";
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
  const created = await prisma.tournamentEntryZoneAssignment.create({
    data: {
      tournamentEntryId: entryId,
      tournamentZoneId,
      assignmentType,
      assignedByUserId: session.id,
      notes,
    },
    include: {
      tournamentZone: { include: { zone: { select: { name: true, code: true } } } },
    },
  });
  return NextResponse.json(created);
}
