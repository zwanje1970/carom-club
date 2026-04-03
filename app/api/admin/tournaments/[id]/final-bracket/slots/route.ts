import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { fetchOrImportBracketSnapshotByKind, patchBracketMatchByKind } from "@/lib/bracket-match-service";

/** 본선 1라운드 슬롯 수동 배정. PATCH → canManageTournament. body: { slots: { slotIndex: number, entryId: string }[] } */
export async function PATCH(
  request: Request,
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

  let body: { slots?: { slotIndex: number; entryId: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const slots = Array.isArray(body?.slots) ? body.slots : [];
  if (slots.length === 0) return NextResponse.json({ ok: true });

  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "FINAL");
  if (!bracket) {
    return NextResponse.json({ error: "대진표가 생성되지 않았습니다." }, { status: 404 });
  }

  const round0 = await prisma.bracketMatch.findMany({
    where: { bracket: { tournamentId, kind: "FINAL" }, round: { roundNumber: 0 } },
    orderBy: { matchNumber: "asc" },
  });
  for (const { slotIndex, entryId } of slots) {
    if (slotIndex < 0 || slotIndex >= round0.length * 2) continue;
    const matchIndex = Math.floor(slotIndex / 2);
    const slot = slotIndex % 2 === 0 ? "A" : "B";
    const match = round0[matchIndex];
    if (!match) continue;
    const value = entryId === undefined || entryId === "" ? null : entryId;
    const data = slot === "A" ? { entryIdA: value } : { entryIdB: value };
    await patchBracketMatchByKind(prisma, tournamentId, "FINAL", match.id, { ...data, status: "PENDING" }, { actorUserId: session.id, allowCompletedResultEdit: true });
  }
  return NextResponse.json({ ok: true });
}
