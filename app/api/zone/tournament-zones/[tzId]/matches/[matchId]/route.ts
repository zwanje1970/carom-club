import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageTournamentZone } from "@/lib/auth-zone";
import { fetchOrImportZoneBracketSnapshotByZoneId, patchBracketMatchByKind } from "@/lib/bracket-match-service";

/** ZONE_MANAGER: 경기 결과 입력. PATCH → 본인 배정 권역만. body: scoreA?, scoreB?, winnerEntryId?, status? */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tzId: string; matchId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { tzId, matchId } = await params;
  const canManage = await canManageTournamentZone(session, tzId);
  if (!canManage) return NextResponse.json({ error: "이 권역을 수정할 권한이 없습니다." }, { status: 403 });

  const zone = await prisma.tournamentZone.findUnique({
    where: { id: tzId },
    select: { tournamentId: true },
  });
  if (!zone) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });
  await fetchOrImportZoneBracketSnapshotByZoneId(zone.tournamentId, tzId);

  let body: { scoreA?: number; scoreB?: number; winnerEntryId?: string | null; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const data: { scoreA?: number; scoreB?: number; winnerEntryId?: string | null; status?: string } = {};
  if (body.scoreA !== undefined) data.scoreA = body.scoreA;
  if (body.scoreB !== undefined) data.scoreB = body.scoreB;
  if (body.winnerEntryId !== undefined) data.winnerEntryId = body.winnerEntryId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.winnerEntryId && !body.status) data.status = "COMPLETED";

  const result = await patchBracketMatchByKind(prisma, zone.tournamentId, "ZONE", matchId, data, {
    allowCompletedResultEdit: true,
    zoneId: tzId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.match);
}
