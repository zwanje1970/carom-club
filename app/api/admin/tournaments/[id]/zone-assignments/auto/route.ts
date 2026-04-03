import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";
import { autoAssignTournamentEntriesToZones } from "@/lib/tournaments/national";

/** 자동 배정: 미배정 참가자를 권역에 균등 분배. POST → canManageTournament */
export async function POST(
  _request: Request,
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

  const tournamentZones = await prisma.tournamentZone.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
  });
  if (tournamentZones.length === 0) {
    return NextResponse.json({ error: "권역이 없습니다. 먼저 부/권역 설정에서 권역을 연결해 주세요." }, { status: 400 });
  }
  const result = await autoAssignTournamentEntriesToZones(tournamentId, session.id);
  if (result.assigned === 0) {
    return NextResponse.json({ assigned: 0, message: "미배정 참가자가 없습니다." });
  }
  return NextResponse.json({ assigned: result.assigned, assignments: result.assignments });
}
