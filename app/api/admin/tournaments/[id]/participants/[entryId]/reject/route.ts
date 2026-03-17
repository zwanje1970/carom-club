import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canManageTournament } from "@/lib/permissions";

/** 참가 신청 반려. POST → canManageTournament. body: rejectionReason? */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, entryId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "해당 대회를 수정할 권한이 없습니다." }, { status: 403 });
  }
  if (tournament.status === "BRACKET_GENERATED") {
    return NextResponse.json(
      { error: "대진표가 생성된 후에는 참가 확정/반려를 변경할 수 없습니다." },
      { status: 400 }
    );
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  if (entry.status !== "APPLIED") {
    return NextResponse.json({ error: "신청됨 상태만 반려할 수 있습니다." }, { status: 400 });
  }

  let body: { rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;

  const now = new Date();
  await prisma.tournamentEntry.update({
    where: { id: entryId },
    data: { status: "REJECTED", rejectionReason, reviewedAt: now },
  });

  try {
    await prisma.notification.create({
      data: {
        userId: entry.userId,
        message: rejectionReason
          ? `참가 신청이 반려되었습니다. 사유: ${rejectionReason}`
          : "참가 신청이 반려되었습니다. 문의는 대회 운영자에게 해 주세요.",
      },
    });
  } catch {
    // notification 실패해도 반려는 완료된 것으로 처리
  }

  return NextResponse.json({ ok: true, status: "REJECTED" });
}
