import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";

const ALLOWED_STATUSES = ["APPLIED", "CONFIRMED", "CANCELED", "REJECTED"] as const;

/** 관리자: 참가 신청 강제 상태 변경 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: tournamentId, entryId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  if (tournament.status === "BRACKET_GENERATED") {
    return NextResponse.json(
      { error: "대진표 생성 후에는 상태를 임의로 변경할 수 없습니다." },
      { status: 400 }
    );
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const status = body.status;
  if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return NextResponse.json(
      { error: "status는 APPLIED, CONFIRMED, CANCELED, REJECTED 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    await prisma.tournamentEntry.update({
      where: { id: entryId },
      data: {
        status,
        ...(status === "APPLIED" && { waitingListOrder: null, paidAt: null, reviewedAt: null }),
        ...(status === "REJECTED" && { reviewedAt: new Date() }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin force status error", e);
    return NextResponse.json(
      { error: "상태 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
