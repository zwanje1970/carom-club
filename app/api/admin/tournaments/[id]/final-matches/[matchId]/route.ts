import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";
import { clearDownstreamFromMatch } from "@/lib/bracket-downstream";

/**
 * 본선 경기 강제 수정. PATCH → canManageTournament
 * - 참가자 강제입력/교체/추가/삭제(entryIdA, entryIdB) 언제든 가능
 * - 특정 경기만 수정 가능, 수정 시 해당 경기에서 진출하는 다음 라운드부터 자동으로 슬롯 비움(이후 승자 입력 시 자동 반영)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, matchId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const match = await prisma.tournamentFinalMatch.findFirst({
    where: { id: matchId, tournamentId },
  });
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없습니다." }, { status: 404 });

  let body: {
    scoreA?: number;
    scoreB?: number;
    winnerEntryId?: string | null;
    status?: string;
    entryIdA?: string | null;
    entryIdB?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 참가자 슬롯: 언제든 강제 수정 가능 (참가확정자만 허용)
  if (body.entryIdA !== undefined || body.entryIdB !== undefined) {
    const confirmedIds = await prisma.tournamentEntry
      .findMany({
        where: { tournamentId, status: "CONFIRMED" },
        select: { id: true },
      })
      .then((rows) => new Set(rows.map((r) => r.id)));
    const check = (id: string | null | undefined) => {
      if (id == null || id === "") return true;
      return confirmedIds.has(id);
    };
    if (body.entryIdA !== undefined && !check(body.entryIdA)) {
      return NextResponse.json({ error: "A 슬롯에는 참가확정자만 배치할 수 있습니다." }, { status: 400 });
    }
    if (body.entryIdB !== undefined && !check(body.entryIdB)) {
      return NextResponse.json({ error: "B 슬롯에는 참가확정자만 배치할 수 있습니다." }, { status: 400 });
    }
  }

  // 승자: 수정 후 이 경기의 A/B(반영 후 값) 중 한 명이어야 함
  const effectiveA = body.entryIdA !== undefined ? body.entryIdA : match.entryIdA;
  const effectiveB = body.entryIdB !== undefined ? body.entryIdB : match.entryIdB;
  if (body.winnerEntryId != null && body.winnerEntryId !== "") {
    const valid = effectiveA === body.winnerEntryId || effectiveB === body.winnerEntryId;
    if (!valid) {
      return NextResponse.json({ error: "승자는 해당 경기의 A 또는 B 참가자 중 한 명이어야 합니다." }, { status: 400 });
    }
  }
  if (body.scoreA !== undefined && (typeof body.scoreA !== "number" || body.scoreA < 0)) {
    return NextResponse.json({ error: "점수는 0 이상이어야 합니다." }, { status: 400 });
  }
  if (body.scoreB !== undefined && (typeof body.scoreB !== "number" || body.scoreB < 0)) {
    return NextResponse.json({ error: "점수는 0 이상이어야 합니다." }, { status: 400 });
  }

  const data: {
    scoreA?: number | null;
    scoreB?: number | null;
    winnerEntryId?: string | null;
    status?: string;
    entryIdA?: string | null;
    entryIdB?: string | null;
  } = {};
  if (body.scoreA !== undefined) data.scoreA = body.scoreA;
  if (body.scoreB !== undefined) data.scoreB = body.scoreB;
  if (body.winnerEntryId !== undefined) data.winnerEntryId = body.winnerEntryId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.winnerEntryId != null && body.winnerEntryId !== "" && body.status === undefined) data.status = "COMPLETED";
  if (body.entryIdA !== undefined) data.entryIdA = body.entryIdA || null;
  if (body.entryIdB !== undefined) data.entryIdB = body.entryIdB || null;

  // 참가자(A/B) 변경 시: 이 경기 승자·점수 초기화 후 하위 라운드까지 슬롯 비우기
  const slotsChanged =
    (body.entryIdA !== undefined && body.entryIdA !== match.entryIdA) ||
    (body.entryIdB !== undefined && body.entryIdB !== match.entryIdB);
  if (slotsChanged) {
    data.winnerEntryId = null;
    data.scoreA = null;
    data.scoreB = null;
    data.status = (data.entryIdA || data.entryIdB) ? "PENDING" : "PENDING";
  }

  // 승자 제거(초기화) 시: 점수·상태 초기화 후 하위 라운드 정리
  const winnerCleared =
    body.winnerEntryId !== undefined && (body.winnerEntryId === null || body.winnerEntryId === "");
  if (winnerCleared) {
    data.scoreA = null;
    data.scoreB = null;
    if (data.status === undefined) data.status = "PENDING";
  }

  const updated = await prisma.tournamentFinalMatch.update({
    where: { id: matchId },
    data,
  });

  // 하위 라운드 정리: 수정된 경기에서 진출하는 다음 경기부터 재귀적으로 슬롯 비움 → 이후 라운드가 깨지지 않음
  if (slotsChanged || winnerCleared) {
    await clearDownstreamFromMatch(tournamentId, matchId);
  }

  // 승자 입력 시 다음 경기 슬롯에 자동 반영 (수정된 데이터 기준)
  if (updated.winnerEntryId && updated.nextMatchId && updated.nextSlot) {
    const nextData = updated.nextSlot === "A" ? { entryIdA: updated.winnerEntryId } : { entryIdB: updated.winnerEntryId };
    await prisma.tournamentFinalMatch.update({
      where: { id: updated.nextMatchId },
      data: { ...nextData, status: "IN_PROGRESS" },
    });
  }

  return NextResponse.json(updated);
}
