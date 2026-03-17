import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { isQualifierLocked } from "@/lib/tournament-stage";

/** 진출 규칙 수정. PATCH → canManageTournament. body: advanceCount?, advanceRuleType? */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id, tzId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }
  if (isQualifierLocked(tournament.tournamentStage)) {
    return NextResponse.json(
      { error: "본선 준비가 완료된 후에는 권역 진출 규칙을 수정할 수 없습니다." },
      { status: 409 }
    );
  }

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId: id },
  });
  if (!tz) return NextResponse.json({ error: "대회-권역 연결을 찾을 수 없습니다." }, { status: 404 });

  let body: { advanceCount?: number; advanceRuleType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const data: { advanceCount?: number; advanceRuleType?: string } = {};
  if (typeof body?.advanceCount === "number" && body.advanceCount >= 0) data.advanceCount = body.advanceCount;
  if (body?.advanceRuleType === "TOP_N" || body?.advanceRuleType === "WINNER_ONLY") data.advanceRuleType = body.advanceRuleType;

  if (Object.keys(data).length === 0) {
    const updated = await prisma.tournamentZone.findUnique({ where: { id: tzId } });
    return NextResponse.json(updated ?? tz);
  }

  const updated = await prisma.tournamentZone.update({
    where: { id: tzId },
    data,
  });
  return NextResponse.json(updated);
}

/** 대회-권역 연결 제거. DELETE → canManageTournament */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id, tzId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }
  if (isQualifierLocked(tournament.tournamentStage)) {
    return NextResponse.json(
      { error: "본선 준비가 완료된 후에는 권역 설정을 변경할 수 없습니다." },
      { status: 409 }
    );
  }

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId: id },
  });
  if (!tz) {
    return NextResponse.json({ error: "대회-권역 연결을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.tournamentZone.delete({ where: { id: tzId } });
  return NextResponse.json({ ok: true });
}
