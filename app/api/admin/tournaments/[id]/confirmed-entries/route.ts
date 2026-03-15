import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewTournament } from "@/lib/permissions";
import { getDisplayName } from "@/lib/display-name";

/** 참가확정자 목록 (수동 배치 드롭다운 등). GET → canViewTournament. 대기자 제외. */
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
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId, status: "CONFIRMED" },
    include: { user: true },
    orderBy: [{ userId: "asc" }, { slotNumber: "asc" }],
  });

  const list = entries.map((e) => {
    const name = getDisplayName(e.user);
    const label = (e.slotNumber ?? 1) > 1 ? `${name} (슬롯${e.slotNumber})` : name;
    return {
      id: e.id,
      userId: e.userId,
      userName: name,
      slotNumber: e.slotNumber ?? 1,
      label,
    };
  });

  return NextResponse.json({ entries: list });
}
