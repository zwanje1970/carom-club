import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { rejectTournamentEntryApplied } from "@/lib/tournament-entry-operations";

/** 참가 신청 반려. POST → canManageTournament. body: rejectionReason? */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, entryId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }

  let body: { rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;

  const result = await rejectTournamentEntryApplied(tournamentId, entryId, rejectionReason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
