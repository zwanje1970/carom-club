import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament, canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";
import { assignTournamentEntryToZone } from "@/lib/tournaments/national";

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
        ...(filterZoneId ? { zoneId: filterZoneId } : {}),
      },
      orderBy: [{ status: "asc" }, { waitingListOrder: "asc" }, { createdAt: "asc" }],
      include: {
        user: {
          select: { id: true, name: true },
          include: { memberProfile: { select: { handicap: true, avg: true } } },
        },
        zone: { include: { zone: { select: { id: true, name: true, code: true } } } },
      },
    }),
    prisma.tournamentEntryZoneAssignment.findMany({
      where: { entry: { tournamentId } },
      select: {
        id: true,
        tournamentEntryId: true,
        tournamentZoneId: true,
        assignmentType: true,
        assignedAt: true,
        notes: true,
      },
    }),
    prisma.tournamentZone.findMany({
      where: { tournamentId },
      orderBy: { sortOrder: "asc" },
      include: { zone: { select: { id: true, name: true, code: true } } },
    }),
  ]);

  const unassignedCount = entries.filter((e) => !e.zoneId).length;
  const assignmentMap = new Map(assignments.map((a) => [a.tournamentEntryId, a]));
  const zoneCounts = tournamentZones.map((tz) => ({
    tournamentZoneId: tz.id,
    zoneName: tz.name ?? tz.zone.name,
    zoneCode: tz.code ?? tz.zone.code,
    count: entries.filter((e) => e.zoneId === tz.id).length,
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
      zoneAssignment: e.zone
        ? {
            id: assignmentMap.get(e.id)?.id ?? e.zoneId ?? e.id,
            tournamentZoneId: e.zoneId,
            zoneName: e.zone.name ?? e.zone.zone.name,
            zoneCode: e.zone.code ?? e.zone.zone.code,
            assignmentType: assignmentMap.get(e.id)?.assignmentType ?? "AUTO",
            assignedAt: (assignmentMap.get(e.id)?.assignedAt ?? e.updatedAt).toISOString(),
            notes: assignmentMap.get(e.id)?.notes ?? null,
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

  const updated = await assignTournamentEntryToZone({
    tournamentId,
    entryId,
    tournamentZoneId,
    actorUserId: session.id,
    assignmentType: body.assignmentType === "AUTO" ? "AUTO" : "MANUAL",
    notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
  });
  if (!updated) {
    return NextResponse.json({ error: "참가 신청 또는 권역을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(updated);
}
