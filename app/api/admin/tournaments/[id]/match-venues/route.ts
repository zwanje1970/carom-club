import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageTournament } from "@/lib/permissions";

/** 경기장 목록 조회. GET → canManageTournament */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const list = await prisma.tournamentMatchVenue.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ tournamentId, venues: list });
}

/** 경기장 일괄 저장. PATCH → canManageTournament. body: { venues: [{ venueNumber, displayLabel, venueName?, address?, phone? }] } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { venues?: Array<{ venueNumber: number; displayLabel: string; venueName?: string; address?: string; phone?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const venues = Array.isArray(body?.venues) ? body.venues : [];
  if (venues.length > 32) return NextResponse.json({ error: "경기장은 최대 32개까지 등록할 수 있습니다." }, { status: 400 });

  const existing = await prisma.tournamentMatchVenue.findMany({
    where: { tournamentId },
  });
  const toDelete = existing.filter((e) => !venues.some((v) => v.venueNumber === e.venueNumber));
  for (const e of toDelete) {
    await prisma.tournamentMatchVenue.delete({ where: { id: e.id } });
  }

  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    const num = Number(v.venueNumber);
    if (!Number.isInteger(num) || num < 1) continue;
    const displayLabel = typeof v.displayLabel === "string" ? v.displayLabel.trim() || `${num}경기장` : `${num}경기장`;
    const venueName = typeof v.venueName === "string" ? v.venueName.trim() || null : null;
    const address = typeof v.address === "string" ? v.address.trim() || null : null;
    const phone = typeof v.phone === "string" ? v.phone.trim() || null : null;
    const existingOne = existing.find((e) => e.venueNumber === num);
    if (existingOne) {
      await prisma.tournamentMatchVenue.update({
        where: { id: existingOne.id },
        data: { displayLabel, venueName, address, phone, sortOrder: i },
      });
    } else {
      await prisma.tournamentMatchVenue.create({
        data: {
          tournamentId,
          venueNumber: num,
          displayLabel,
          venueName,
          address,
          phone,
          sortOrder: i,
        },
      });
    }
  }

  const list = await prisma.tournamentMatchVenue.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ tournamentId, venues: list });
}
