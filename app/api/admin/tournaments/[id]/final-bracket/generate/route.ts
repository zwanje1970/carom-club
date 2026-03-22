import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { buildFinalBracketPlan, orderQualifiersForAutoAssign } from "@/lib/final-bracket";
import {
  createBracketMatchesFromPlan,
  fetchMatchVenueIdsOrdered,
  getOrCreateTournamentRoundByName,
  sortFinalBracketPlan,
} from "@/lib/tournament-bracket-matches";
import { syncBracketMatchProgressStates } from "@/lib/tournament-match-progress";

/** 본선 대진표 생성. POST → canManageTournament. body: size (32|64), assignMode (auto|manual), forceRegenerate? (PLATFORM_ADMIN만) */
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
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { size?: number; assignMode?: string; forceRegenerate?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const forceRegenerate = body?.forceRegenerate === true && session.role === "PLATFORM_ADMIN";

  const existing = await prisma.tournamentFinalMatch.findFirst({
    where: { tournamentId },
  });
  if (existing && !forceRegenerate) {
    return NextResponse.json({ error: "이미 본선 대진이 생성되어 있습니다." }, { status: 400 });
  }

  const size = (body?.size === 64 ? 64 : 32) as 32 | 64;
  const assignMode = body?.assignMode === "manual" ? "manual" : "auto";

  const qualifiers = await prisma.tournamentFinalQualifier.findMany({
    where: { tournamentId },
    orderBy: [{ seedOrder: "asc" }, { qualifiedRank: "asc" }, { tournamentZoneId: "asc" }],
  });
  if (qualifiers.length < 2) {
    return NextResponse.json({ error: "본선 참가자 수가 부족합니다. 진출자 취합을 먼저 진행하세요." }, { status: 400 });
  }
  const entryIds = qualifiers.map((q) => q.entryId);
  if (new Set(entryIds).size !== entryIds.length) {
    return NextResponse.json({ error: "진출자 데이터가 유효하지 않습니다. (중복 참가자)" }, { status: 400 });
  }

  let slotEntries: (string | null)[];
  if (assignMode === "auto") {
    const ordered = orderQualifiersForAutoAssign(
      qualifiers.map((q) => ({ entryId: q.entryId, tournamentZoneId: q.tournamentZoneId, qualifiedRank: q.qualifiedRank }))
    );
    slotEntries = ordered.slice(0, size);
  } else {
    slotEntries = qualifiers.slice(0, size).map((q) => q.entryId);
  }

  const plan = buildFinalBracketPlan(slotEntries, size);
  const sorted = sortFinalBracketPlan(plan);

  await prisma.$transaction(async (tx) => {
    await tx.tournamentFinalMatch.deleteMany({ where: { tournamentId } });
    const round = await getOrCreateTournamentRoundByName(tx, tournamentId, "본선 브래킷");
    const venueIds = await fetchMatchVenueIdsOrdered(tx, tournamentId);
    await createBracketMatchesFromPlan(tx, {
      tournamentId,
      tournamentRoundId: round.id,
      sortedPlan: sorted,
      bracketPhase: "MAIN",
      matchVenueIdsInOrder: venueIds.length ? venueIds : undefined,
    });
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: "FINAL_RUNNING" },
    });
  });

  await syncBracketMatchProgressStates(prisma, tournamentId);

  return NextResponse.json({ ok: true, matchCount: plan.length, size });
}
