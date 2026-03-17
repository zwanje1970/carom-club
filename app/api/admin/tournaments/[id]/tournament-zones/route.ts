import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament, canManageTournament } from "@/lib/permissions";

/** 대회에 연결된 권역 목록. GET → canViewTournament */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 볼 권한이 없습니다." }, { status: 403 });
  }

  const list = await prisma.tournamentZone.findMany({
    where: { tournamentId: id },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json(list);
}

/** 대회에 권역 연결. POST → canManageTournament */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
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

  let body: { zoneId?: string; name?: string; code?: string; sortOrder?: number; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const zoneId = typeof body?.zoneId === "string" ? body.zoneId.trim() : "";
  if (!zoneId) {
    return NextResponse.json({ error: "zoneId가 필요합니다." }, { status: 400 });
  }

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) {
    return NextResponse.json({ error: "해당 권역을 찾을 수 없습니다." }, { status: 404 });
  }

  const existing = await prisma.tournamentZone.findUnique({
    where: { tournamentId_zoneId: { tournamentId: id, zoneId } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 이 대회에 연결된 권역입니다." }, { status: 400 });
  }

  const maxOrder = await prisma.tournamentZone
    .aggregate({
      where: { tournamentId: id },
      _max: { sortOrder: true },
    })
    .then((r) => r._max.sortOrder ?? -1);
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : maxOrder + 1;
  const name = typeof body.name === "string" ? body.name.trim() || null : null;
  const code = typeof body.code === "string" ? body.code.trim() || null : null;
  const status = typeof body.status === "string" ? body.status.trim() || null : null;

  const tz = await prisma.tournamentZone.create({
    data: {
      tournamentId: id,
      zoneId,
      name,
      code,
      sortOrder,
      status,
    },
    include: { zone: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json(tz);
}
