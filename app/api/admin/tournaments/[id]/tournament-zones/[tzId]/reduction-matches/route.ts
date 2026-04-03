import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { buildZoneBracket } from "@/lib/zone-bracket";
import { fetchOrImportZoneBracketSnapshotByZoneId, patchBracketMatchByKind } from "@/lib/bracket-match-service";

type ManualMatchInput = {
  matchId: string;
  entryIdA: string | null;
  entryIdB: string | null;
};

function isTruthyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, tzId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const zone = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId },
    select: { tournamentId: true },
  });
  if (!zone) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });

  const bracket = await fetchOrImportZoneBracketSnapshotByZoneId(zone.tournamentId, tzId);
  if (!bracket) return NextResponse.json({ error: "감축경기를 찾을 수 없습니다." }, { status: 404 });

  const reductionMatches = bracket.rounds
    .filter((round) => round.roundType === "REDUCTION")
    .flatMap((round) => round.matches)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  if (reductionMatches.length === 0) {
    return NextResponse.json({ error: "감축경기가 생성되어 있지 않습니다." }, { status: 400 });
  }

  let body: { action?: string; matches?: ManualMatchInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = body.action?.trim();
  if (action !== "reroll" && action !== "manual") {
    return NextResponse.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  }

  const confirmedEntries = await prisma.tournamentEntry.findMany({
    where: { tournamentId: zone.tournamentId, zoneId: tzId, status: "CONFIRMED" },
    orderBy: [{ bracketOrder: "asc" }, { levelCode: "asc" }, { id: "asc" }],
    select: { id: true, levelCode: true, bracketOrder: true },
  });
  const confirmedEntryIds = new Set(confirmedEntries.map((entry) => entry.id));

  if (action === "reroll") {
    const plan = buildZoneBracket(
      confirmedEntries.map((entry) => ({
        entryId: entry.id,
        levelCode: entry.levelCode,
        bracketOrder: entry.bracketOrder,
      }))
    );
    const plannedReduction = plan.rounds.find((round) => round.roundType === "REDUCTION")?.matches ?? [];
    if (plannedReduction.length !== reductionMatches.length) {
      return NextResponse.json(
        {
          error: "현재 감축경기 수와 재추첨 결과가 일치하지 않습니다.",
          currentReductionMatchCount: reductionMatches.length,
          plannedReductionMatchCount: plannedReduction.length,
        },
        { status: 409 }
      );
    }

    for (let index = 0; index < reductionMatches.length; index++) {
      const source = reductionMatches[index]!;
      const planned = plannedReduction[index]!;
      const result = await patchBracketMatchByKind(
        prisma,
        zone.tournamentId,
        "ZONE",
        source.id,
        {
          entryIdA: planned.entryIdA,
          entryIdB: planned.entryIdB,
          winnerEntryId: null,
          scoreA: undefined,
          scoreB: undefined,
          status: "PENDING",
          isManualOverride: false,
        },
        {
          actorUserId: session.id,
          allowCompletedResultEdit: true,
          zoneId: tzId,
        }
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
    }

    return NextResponse.json({
      ok: true,
      action: "reroll",
      reductionMatchCount: reductionMatches.length,
      manualReviewRequired: plan.manualReviewRequired,
    });
  }

  const manualMatches = Array.isArray(body.matches) ? body.matches : [];
  if (manualMatches.length !== reductionMatches.length) {
    return NextResponse.json(
      {
        error: "수동 지정은 감축경기 전체를 모두 지정해야 합니다.",
        currentReductionMatchCount: reductionMatches.length,
        providedMatchCount: manualMatches.length,
      },
      { status: 400 }
    );
  }

  const reductionMatchById = new Map(reductionMatches.map((match) => [match.id, match]));
  const seenMatchIds = new Set<string>();
  const seenParticipantIds = new Set<string>();
  for (const item of manualMatches) {
    if (!isTruthyString(item?.matchId)) {
      return NextResponse.json({ error: "감축경기 id가 올바르지 않습니다." }, { status: 400 });
    }
    if (seenMatchIds.has(item.matchId)) {
      return NextResponse.json({ error: "감축경기 id가 중복되었습니다." }, { status: 400 });
    }
    seenMatchIds.add(item.matchId);
    if (!reductionMatchById.has(item.matchId)) {
      return NextResponse.json({ error: "감축경기만 수동 지정할 수 있습니다." }, { status: 400 });
    }
    if (item.entryIdA && !confirmedEntryIds.has(item.entryIdA)) {
      return NextResponse.json({ error: "A 참가자는 해당 권역의 참가확정자만 지정할 수 있습니다." }, { status: 400 });
    }
    if (item.entryIdB && !confirmedEntryIds.has(item.entryIdB)) {
      return NextResponse.json({ error: "B 참가자는 해당 권역의 참가확정자만 지정할 수 있습니다." }, { status: 400 });
    }
    if (!item.entryIdA || !item.entryIdB) {
      return NextResponse.json({ error: "수동 지정은 A/B 참가자를 모두 선택해야 합니다." }, { status: 400 });
    }
    if (item.entryIdA === item.entryIdB) {
      return NextResponse.json({ error: "같은 참가자를 A/B에 동시에 지정할 수 없습니다." }, { status: 400 });
    }
    if (seenParticipantIds.has(item.entryIdA) || seenParticipantIds.has(item.entryIdB)) {
      return NextResponse.json({ error: "같은 참가자를 여러 감축경기에 중복 지정할 수 없습니다." }, { status: 400 });
    }
    seenParticipantIds.add(item.entryIdA);
    seenParticipantIds.add(item.entryIdB);
    const result = await patchBracketMatchByKind(
      prisma,
      zone.tournamentId,
      "ZONE",
      item.matchId,
      {
        entryIdA: item.entryIdA || null,
        entryIdB: item.entryIdB || null,
        winnerEntryId: null,
        scoreA: undefined,
        scoreB: undefined,
        status: "PENDING",
        isManualOverride: true,
      },
      {
        actorUserId: session.id,
        allowCompletedResultEdit: true,
        zoneId: tzId,
      }
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  return NextResponse.json({
    ok: true,
    action: "manual",
    reductionMatchCount: reductionMatches.length,
  });
}
