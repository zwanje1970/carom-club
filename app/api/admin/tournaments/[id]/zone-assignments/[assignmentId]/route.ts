import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";

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
    include: { organization: { select: { ownerUserId: true } } },
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

  const data: { tournamentZoneId?: string; notes?: string | null; assignedAt?: Date; assignedByUserId?: string } = {};
  if (typeof body?.tournamentZoneId === "string" && body.tournamentZoneId.trim()) {
    const tz = await prisma.tournamentZone.findFirst({
      where: { id: body.tournamentZoneId.trim(), tournamentId },
    });
    if (!tz) return NextResponse.json({ error: "해당 대회의 권역을 찾을 수 없습니다." }, { status: 404 });
    data.tournamentZoneId = tz.id;
    data.assignedAt = new Date();
    data.assignedByUserId = session.id;
  }
  if (body?.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(assignment);
  }

  const updated = await prisma.tournamentEntryZoneAssignment.update({
    where: { id: assignmentId },
    data,
    include: {
      tournamentZone: { include: { zone: { select: { name: true, code: true } } } },
    },
  });
  return NextResponse.json(updated);
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
    include: { organization: { select: { ownerUserId: true } } },
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

  await prisma.tournamentEntryZoneAssignment.delete({
    where: { id: assignmentId },
  });
  return NextResponse.json({ ok: true });
}
