import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";
import { assignTournamentEntryToZone, clearTournamentEntryZoneAssignment } from "@/lib/tournaments/national";

/** 배정 변경. PATCH → canManageTournament. body: tournamentZoneId?, notes? */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, assignmentId } = await params;
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

  const assignment = await prisma.tournamentEntryZoneAssignment.findUnique({
    where: { id: assignmentId },
    include: { entry: true },
  });
  if (!assignment || assignment.entry.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "배정을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: { tournamentZoneId?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updated = await assignTournamentEntryToZone({
    tournamentId,
    entryId: assignment.entry.id,
    tournamentZoneId:
      typeof body?.tournamentZoneId === "string" && body.tournamentZoneId.trim()
        ? body.tournamentZoneId.trim()
        : assignment.tournamentZoneId,
    actorUserId: session.id,
    assignmentType: "MANUAL",
    notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
  });
  return NextResponse.json(updated ?? assignment);
}

/** 배정 해제. DELETE → canManageTournament */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, assignmentId } = await params;
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

  const assignment = await prisma.tournamentEntryZoneAssignment.findUnique({
    where: { id: assignmentId },
    include: { entry: true },
  });
  if (!assignment || assignment.entry.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "배정을 찾을 수 없습니다." }, { status: 404 });
  }

  await clearTournamentEntryZoneAssignment({
    tournamentId,
    entryId: assignment.entry.id,
  });
  return NextResponse.json({ ok: true });
}
