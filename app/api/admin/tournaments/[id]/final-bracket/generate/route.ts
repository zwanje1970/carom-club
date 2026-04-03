import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { buildFinalBracketPlan, orderQualifiersForAutoAssign } from "@/lib/final-bracket";
import { createBracketMatchesFromPlanByKind, sortBracketPlan, syncBracketMatchProgressStatesByKind } from "@/lib/bracket-match-service";

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

  const existing = await prisma.bracket.findFirst({
    where: { tournamentId, kind: "FINAL" },
    select: { id: true },
  });
  if (existing && !forceRegenerate) {
    return NextResponse.json({ error: "이미 본선 대진이 생성되어 있습니다." }, { status: 400 });
  }

  const size = ((tournament.targetFinalSize === 64 ? 64 : tournament.targetFinalSize === 32 ? 32 : body?.size === 64 ? 64 : 32) as 32 | 64);
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

  const plan = sortBracketPlan(buildFinalBracketPlan(slotEntries, size));

  await prisma.$transaction(async (tx) => {
    await tx.bracketMatch.deleteMany({
      where: { bracket: { tournamentId, kind: "FINAL" } },
    });
    await tx.bracketRound.deleteMany({
      where: { bracket: { tournamentId, kind: "FINAL" } },
    });
    await tx.bracket.deleteMany({
      where: { tournamentId, kind: "FINAL" },
    });
    await createBracketMatchesFromPlanByKind(tx, {
      tournamentId,
      kind: "FINAL",
      sortedPlan: plan,
    });
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: "FINAL_RUNNING" },
    });
  });

  await syncBracketMatchProgressStatesByKind(prisma, tournamentId, "FINAL");

  return NextResponse.json({ ok: true, matchCount: plan.length, size });
}
