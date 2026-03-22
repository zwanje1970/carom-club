import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 클라 콘솔: 경기장(매치베뉴) 일괄 저장 */
export async function PATCH(
  request: Request,
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

  let body: { venues?: Array<{ venueNumber: number; displayLabel: string; venueName?: string; address?: string; phone?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const venues = Array.isArray(body?.venues) ? body.venues : [];
  if (venues.length > 32) {
    return NextResponse.json({ error: "경기장은 최대 32개까지 등록할 수 있습니다." }, { status: 400 });
  }

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
    const displayLabel =
      typeof v.displayLabel === "string" ? v.displayLabel.trim() || `${num}경기장` : `${num}경기장`;
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
