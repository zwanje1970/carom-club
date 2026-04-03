import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { parseBracketOpsPolicy } from "@/lib/bracket-ops-policy";
import { fetchOrImportBracketSnapshotByKind, patchMainBracketMatch } from "@/lib/bracket-match-service";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";
import type { FinalMatchPatchBody } from "@/lib/tournament-final-match-patch";

/** 클라 콘솔: 본선/단판 Match 목록 + 참가자·경기장 (편집 UI용) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const [tournament, rule, venues, entries] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, status: true, startAt: true, isScotch: true },
    }),
    prisma.tournamentRule.findUnique({
      where: { tournamentId },
      select: { bracketConfig: true },
    }),
    prisma.tournamentMatchVenue.findMany({
      where: { tournamentId },
      orderBy: [{ sortOrder: "asc" }, { venueNumber: "asc" }],
    }),
    prisma.tournamentEntry.findMany({
      where: { tournamentId, status: "CONFIRMED" },
      include: { user: { select: { name: true } } },
      orderBy: [{ userId: "asc" }, { slotNumber: "asc" }],
    }),
  ]);

  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const bracketOpsPolicy = parseBracketOpsPolicy(rule?.bracketConfig);
  const bracketSnapshot = await fetchOrImportBracketSnapshotByKind(tournamentId, "MAIN");
  if (!bracketSnapshot) {
    return NextResponse.json({ error: "대진표가 생성되지 않았습니다." }, { status: 404 });
  }

  const entryMap = Object.fromEntries(entries.map((e) => [e.id, e]));
  const venueMap = Object.fromEntries(venues.map((v) => [v.id, v]));

  const labelEntry = (id: string | null) => {
    if (!id) return null;
    const e = entryMap[id];
    if (!e) return `엔트리 ${id.slice(0, 8)}…`;
    return (
      formatTournamentEntryDisplayName({
        displayName: e.displayName,
        playerAName: e.playerAName,
        playerBName: e.playerBName,
        user: e.user,
        slotNumber: e.slotNumber,
        isScotch: tournament.isScotch === true,
      }) || `엔트리 ${id.slice(0, 8)}…`
    );
  };

  return NextResponse.json({
    tournament,
    matchVenues: venues,
    entries: entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      slotNumber: e.slotNumber,
      round: e.round,
      displayName:
        formatTournamentEntryDisplayName({
          displayName: e.displayName,
          playerAName: e.playerAName,
          playerBName: e.playerBName,
          user: e.user,
          slotNumber: e.slotNumber,
          isScotch: tournament.isScotch === true,
        }) || e.id.slice(0, 8),
    })),
    matches: bracketSnapshot.matches.map((m) => {
      const row = m as typeof m & {
        scheduledStartAt?: Date | null;
        hasIssue?: boolean;
        issueNote?: string | null;
      };
      const round = bracketSnapshot.rounds.find((r) => r.id === m.roundId);
      return {
        id: m.id,
        tournamentRoundId: m.roundId,
        matchVenueId: m.venueId,
        bracketPhase: bracketSnapshot.kind,
        roundIndex: round?.roundNumber ?? 0,
        matchIndex: m.matchNumber,
        entryIdA: m.entryIdA,
        entryIdB: m.entryIdB,
        entryALabel: labelEntry(m.entryIdA),
        entryBLabel: labelEntry(m.entryIdB),
        divisionA: m.entryIdA ? entryMap[m.entryIdA]?.round ?? null : null,
        divisionB: m.entryIdB ? entryMap[m.entryIdB]?.round ?? null : null,
        venueLabel: m.venueId ? venueMap[m.venueId]?.displayLabel ?? null : null,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winnerEntryId: m.winnerEntryId,
        status: m.isBye && m.status !== "COMPLETED" ? "BYE" : m.status,
        nextMatchId: m.nextMatchId,
        nextSlot: m.nextSlot,
        scheduledStartAt: row.scheduledStartAt?.toISOString() ?? null,
        hasIssue: row.hasIssue ?? false,
        issueNote: row.issueNote ?? null,
      };
    }),
  });
}

type BulkPatchBody = { updates?: Array<{ matchId: string } & FinalMatchPatchBody> };

/** 일괄 저장: updates 배열 순서대로 PATCH */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rule = await prisma.tournamentRule.findUnique({
    where: { tournamentId },
    select: { bracketConfig: true },
  });
  const policy = parseBracketOpsPolicy(rule?.bracketConfig);
  const patchOpts = {
    actorUserId: session.id,
    allowCompletedResultEdit: policy.allowBracketCompletedResultEdit,
  };
  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "MAIN");

  let body: BulkPatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (updates.length === 0) {
    return NextResponse.json({ error: "updates가 비어 있습니다." }, { status: 400 });
  }
  if (updates.length > 200) {
    return NextResponse.json({ error: "한 번에 최대 200건까지 저장할 수 있습니다." }, { status: 400 });
  }

  if (!bracket) {
    return NextResponse.json({ error: "대진표가 생성되지 않았습니다." }, { status: 404 });
  }

  const results: { matchId: string; ok: boolean; error?: string }[] = [];
  for (const u of updates) {
    const matchId = u.matchId;
    if (!matchId) {
      results.push({ matchId: "", ok: false, error: "matchId 누락" });
      continue;
    }
    const { matchId: _m, ...patch } = u;
    const r = await patchMainBracketMatch(prisma, tournamentId, matchId, patch, patchOpts);
    if (r.ok) {
      results.push({ matchId, ok: true });
    } else {
      results.push({ matchId, ok: false, error: r.error });
    }
  }

  const failed = results.filter((x) => !x.ok);
  if (failed.length > 0) {
    return NextResponse.json(
      { ok: false, message: "일부 저장에 실패했습니다.", results },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, saved: results.length });
}
