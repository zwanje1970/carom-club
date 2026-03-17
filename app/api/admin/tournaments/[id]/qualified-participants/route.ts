import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament, canManageTournament } from "@/lib/permissions";
import { computeAllZoneQualifiers } from "@/lib/final-qualification";
import { isCollectAllowed } from "@/lib/tournament-stage";

/** 본선 진출자 현황. GET → canViewTournament. 저장된 진출자 + 권역별 추출 가능 인원. */
export async function GET(
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
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const [savedQualifiers, computed] = await Promise.all([
    prisma.tournamentFinalQualifier.findMany({
      where: { tournamentId },
      orderBy: [{ tournamentZoneId: "asc" }, { qualifiedRank: "asc" }],
      include: {
        tournamentZone: { include: { zone: { select: { name: true, code: true } } } },
      },
    }),
    computeAllZoneQualifiers(tournamentId),
  ]);

  const entryIds = new Set(savedQualifiers.map((q) => q.entryId));
  const entries = await prisma.tournamentEntry.findMany({
    where: { id: { in: Array.from(entryIds) } },
    include: { user: { select: { name: true } } },
  });
  const entryMap = Object.fromEntries(entries.map((e) => [e.id, e]));

  const byZone: Record<string, { zoneName: string; advanceCount: number; saved: number; computed: number; qualifiers: { entryId: string; userName: string; qualifiedRank: number }[] }> = {};
  for (const z of computed.byZone) {
    byZone[z.tournamentZoneId] = {
      zoneName: z.zoneName,
      advanceCount: z.advanceCount,
      saved: 0,
      computed: z.qualifiers.length,
      qualifiers: [],
    };
  }
  for (const q of savedQualifiers) {
    if (!byZone[q.tournamentZoneId]) {
      byZone[q.tournamentZoneId] = {
        zoneName: q.tournamentZone.name ?? q.tournamentZone.zone.name,
        advanceCount: q.tournamentZone.advanceCount ?? 1,
        saved: 0,
        computed: 0,
        qualifiers: [],
      };
    }
    byZone[q.tournamentZoneId].saved++;
    byZone[q.tournamentZoneId].qualifiers.push({
      entryId: q.entryId,
      userName: entryMap[q.entryId]?.user?.name ?? "—",
      qualifiedRank: q.qualifiedRank,
    });
  }
  for (const z of computed.byZone) {
    if (byZone[z.tournamentZoneId]) byZone[z.tournamentZoneId].computed = z.qualifiers.length;
  }

  const canCollect =
    session.role === "CLIENT_ADMIN" &&
    canManageTournament(session, tournament, tournament.organization) &&
    isCollectAllowed(tournament.tournamentStage);

  return NextResponse.json({
    tournamentId,
    savedCount: savedQualifiers.length,
    computedTotal: computed.total,
    byZone: Object.entries(byZone).map(([tzId, v]) => ({ tournamentZoneId: tzId, ...v })),
    canCollect,
    tournamentStage: tournament.tournamentStage,
  });
}

/** 진출자 취합. POST → canManageTournament. FINAL_READY 이상에서는 재취합 금지. */
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
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isCollectAllowed(tournament.tournamentStage)) {
    return NextResponse.json(
      { error: "본선 준비가 완료된 후에는 진출자 재취합을 할 수 없습니다." },
      { status: 409 }
    );
  }

  const { byZone, total: computedTotal } = await computeAllZoneQualifiers(tournamentId);
  if (computedTotal < 2) {
    return NextResponse.json(
      { error: "권역 예선이 아직 완료되지 않았습니다. 진출 가능 인원이 2명 이상 필요합니다." },
      { status: 400 }
    );
  }
  const entryIds = byZone.flatMap((z) => z.qualifiers.map((q) => q.entryId));
  if (new Set(entryIds).size !== entryIds.length) {
    return NextResponse.json({ error: "진출자 데이터가 유효하지 않습니다. (중복 참가자)" }, { status: 400 });
  }

  await prisma.tournamentFinalQualifier.deleteMany({ where: { tournamentId } });

  let seedOrder = 0;
  for (const z of byZone) {
    for (const q of z.qualifiers) {
      await prisma.tournamentFinalQualifier.create({
        data: {
          tournamentId,
          tournamentZoneId: z.tournamentZoneId,
          entryId: q.entryId,
          qualifiedRank: q.qualifiedRank,
          sourceMatchId: q.sourceMatchId,
          seedOrder: seedOrder++,
        },
      });
    }
  }

  const total = byZone.reduce((s, z) => s + z.qualifiers.length, 0);
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { tournamentStage: "FINAL_READY" },
  });
  return NextResponse.json({ ok: true, collected: total });
}
