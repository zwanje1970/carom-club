import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canViewTournament, canManageTournament } from "@/lib/permissions";

/** 대회에 연결된 당구장(대회 당구장) 목록. GET → canViewTournament */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 볼 권한이 없습니다." }, { status: 403 });
  }

  const list = await prisma.tournamentVenue.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: {
      organization: { select: { id: true, name: true, slug: true, address: true } },
    },
  });
  return NextResponse.json(
    list.map((v) => ({
      id: v.id,
      organizationId: v.organizationId,
      sortOrder: v.sortOrder,
      organization: v.organization,
    }))
  );
}

/** 대회 당구장 추가. POST → canManageTournament */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json();
  const organizationId = body?.organizationId as string | undefined;
  if (!organizationId?.trim()) {
    return NextResponse.json({ error: "organizationId가 필요합니다." }, { status: 400 });
  }

  const venueOrg = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { type: true },
  });
  if (!venueOrg || venueOrg.type !== "VENUE") {
    return NextResponse.json({ error: "당구장(업체 타입 VENUE)만 추가할 수 있습니다." }, { status: 400 });
  }

  try {
    const maxOrder = await prisma.tournamentVenue
      .aggregate({
        where: { tournamentId },
        _max: { sortOrder: true },
      })
      .then((r) => r._max.sortOrder ?? -1);
    await prisma.tournamentVenue.create({
      data: {
        tournamentId,
        organizationId: organizationId.trim(),
        sortOrder: maxOrder + 1,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && e.code === "P2002" ? "이미 추가된 당구장입니다." : "추가에 실패했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 대회 당구장 제거. ?organizationId=xxx. DELETE → canManageTournament */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId 쿼리가 필요합니다." }, { status: 400 });
  }

  try {
    await prisma.tournamentVenue.deleteMany({
      where: { tournamentId, organizationId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
