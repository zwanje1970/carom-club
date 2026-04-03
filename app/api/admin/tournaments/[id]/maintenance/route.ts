import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TOURNAMENT_STAGES } from "@/lib/tournament-stage";

/** 플랫폼 관리자 전용: 대회 유지보수. POST → PLATFORM_ADMIN only. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { tournamentZones: { select: { id: true } } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  let body: { action?: string; tournamentStage?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const action = body?.action;
  if (action === "reset_zone_results") {
    const zoneIds = tournament.tournamentZones.map((z) => z.id);
    const [deletedLegacy, deletedMatches, deletedRounds, deletedBrackets] = await Promise.all([
      prisma.tournamentZoneMatch.deleteMany({
        where: { tournamentZoneId: { in: zoneIds } },
      }),
      prisma.bracketMatch.deleteMany({
        where: { bracket: { tournamentId, kind: "ZONE" } },
      }),
      prisma.bracketRound.deleteMany({
        where: { bracket: { tournamentId, kind: "ZONE" } },
      }),
      prisma.bracket.deleteMany({
        where: { tournamentId, kind: "ZONE" },
      }),
    ]);
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: "SETUP" },
    });
    return NextResponse.json({
      ok: true,
      message: "권역 결과를 초기화했습니다.",
      deleted: deletedLegacy.count + deletedMatches.count + deletedRounds.count + deletedBrackets.count,
    });
  }

  if (action === "reset_qualifiers") {
    const deleted = await prisma.tournamentFinalQualifier.deleteMany({
      where: { tournamentId },
    });
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: tournament.tournamentStage === "FINAL_READY" || tournament.tournamentStage === "FINAL_RUNNING" || tournament.tournamentStage === "COMPLETED" ? "QUALIFIER_COMPLETED" : tournament.tournamentStage },
    });
    return NextResponse.json({ ok: true, message: "진출자 취합을 초기화했습니다.", deleted: deleted.count });
  }

  if (action === "reset_final_bracket") {
    const [deletedLegacy, deletedMatches, deletedRounds, deletedBracket] = await Promise.all([
      prisma.tournamentFinalMatch.deleteMany({ where: { tournamentId } }),
      prisma.bracketMatch.deleteMany({ where: { bracket: { tournamentId, kind: "FINAL" } } }),
      prisma.bracketRound.deleteMany({ where: { bracket: { tournamentId, kind: "FINAL" } } }),
      prisma.bracket.deleteMany({ where: { tournamentId, kind: "FINAL" } }),
    ]);
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: "FINAL_READY" },
    });
    return NextResponse.json({
      ok: true,
      message: "본선 대진을 초기화했습니다.",
      deleted: deletedLegacy.count + deletedMatches.count + deletedRounds.count + deletedBracket.count,
    });
  }

  if (action === "set_stage" && typeof body?.tournamentStage === "string") {
    const stage = body.tournamentStage.trim();
    if (!TOURNAMENT_STAGES.includes(stage as (typeof TOURNAMENT_STAGES)[number])) {
      return NextResponse.json({ error: "유효하지 않은 진행 상태입니다." }, { status: 400 });
    }
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: stage },
    });
    return NextResponse.json({ ok: true, message: `진행 상태를 ${stage}(으)로 변경했습니다.` });
  }

  return NextResponse.json({ error: "지원하지 않는 작업이거나 파라미터가 올바르지 않습니다." }, { status: 400 });
}
