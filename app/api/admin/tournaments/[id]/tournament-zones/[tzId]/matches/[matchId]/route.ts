import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";

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

  const match = await prisma.tournamentZoneMatch.findFirst({
    where: { id: matchId, tournamentZoneId: tzId, tournamentId },
  });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });

  let body: { scoreA?: number; scoreB?: number; winnerEntryId?: string | null; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (match.status === "COMPLETED" && (body.winnerEntryId !== undefined || body.scoreA !== undefined || body.scoreB !== undefined)) {
    return NextResponse.json({ error: "이미 완료된 경기는 수정할 수 없습니다." }, { status: 409 });
  }
  if (body.winnerEntryId != null && body.winnerEntryId !== "") {
    const valid = (match.entryIdA === body.winnerEntryId || match.entryIdB === body.winnerEntryId);
    if (!valid) {
      return NextResponse.json({ error: "승자는 해당 경기의 A 또는 B 참가자 중 한 명이어야 합니다." }, { status: 400 });
    }
  }
  if (body.scoreA !== undefined && (typeof body.scoreA !== "number" || body.scoreA < 0)) {
    return NextResponse.json({ error: "점수는 0 이상이어야 합니다." }, { status: 400 });
  }
  if (body.scoreB !== undefined && (typeof body.scoreB !== "number" || body.scoreB < 0)) {
    return NextResponse.json({ error: "점수는 0 이상이어야 합니다." }, { status: 400 });
  }
  if (!match.entryIdA && !match.entryIdB) {
    return NextResponse.json({ error: "참가자가 없는 경기의 결과를 입력할 수 없습니다." }, { status: 400 });
  }

  const data: { scoreA?: number; scoreB?: number; winnerEntryId?: string | null; status?: string } = {};
  if (body.scoreA !== undefined) data.scoreA = body.scoreA;
  if (body.scoreB !== undefined) data.scoreB = body.scoreB;
  if (body.winnerEntryId !== undefined) data.winnerEntryId = body.winnerEntryId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.winnerEntryId && !body.status) data.status = "COMPLETED";

  const updated = await prisma.tournamentZoneMatch.update({
    where: { id: matchId },
    data,
  });

  if (updated.winnerEntryId && updated.nextMatchId && updated.nextSlot) {
    const nextData = updated.nextSlot === "A" ? { entryIdA: updated.winnerEntryId } : { entryIdB: updated.winnerEntryId };
    await prisma.tournamentZoneMatch.update({
      where: { id: updated.nextMatchId },
      data: { ...nextData, status: "IN_PROGRESS" },
    });
  }

  return NextResponse.json(updated);
}
