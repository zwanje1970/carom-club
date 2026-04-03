import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";
import { fetchOrImportZoneBracketSnapshotByZoneId, patchBracketMatchByKind } from "@/lib/bracket-match-service";

/** 경기 결과 입력. PATCH → canManageTournament. body: scoreA?, scoreB?, winnerEntryId?, status? */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; tzId: string; matchId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, tzId, matchId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (isQualifierLocked(tournament.tournamentStage)) {
    return NextResponse.json(
      { error: "본선 준비가 완료된 후에는 권역 경기 결과를 수정할 수 없습니다." },
      { status: 409 }
    );
  }

  const zone = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId },
    select: { id: true },
  });
  if (!zone) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });
  await fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, tzId);

  let body: { scoreA?: number; scoreB?: number; winnerEntryId?: string | null; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const data: { scoreA?: number; scoreB?: number; winnerEntryId?: string | null; status?: string } = {};
  if (body.scoreA !== undefined) data.scoreA = body.scoreA;
  if (body.scoreB !== undefined) data.scoreB = body.scoreB;
  if (body.winnerEntryId !== undefined) data.winnerEntryId = body.winnerEntryId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.winnerEntryId && !body.status) data.status = "COMPLETED";

  const result = await patchBracketMatchByKind(prisma, tournamentId, "ZONE", matchId, data, {
    allowCompletedResultEdit: false,
    zoneId: tzId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.match);
}
