import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";
import { sendPushToUser } from "@/lib/push/sendPush";

/** 입금확인 → 참가확정 또는 대기자 등록. 신청자가 '입금 완료' 체크한 건만 처리 가능, 한 번만 처리(paidAt 설정으로 중복 방지) */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
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
    include: { organization: { select: ORGANIZATION_SELECT_OWNER }, rule: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
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
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (entry.status !== "APPLIED") {
    return NextResponse.json(
      { error: "신청 상태가 아니거나 이미 처리되었습니다." },
      { status: 400 }
    );
  }
  if (entry.paymentMarkedByApplicantAt == null) {
    return NextResponse.json(
      { error: "신청자가 '입금 완료'를 체크한 건만 입금확인할 수 있습니다." },
      { status: 400 }
    );
  }
  if (entry.paidAt != null) {
    return NextResponse.json(
      { error: "이미 입금확인된 신청입니다. 중복 처리되지 않습니다." },
      { status: 400 }
    );
  }

  const maxParticipants = tournament.maxParticipants ?? tournament.rule?.maxEntries ?? 0;
  const confirmedCount = await prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  const useWaiting = tournament.rule?.useWaiting ?? false;
  const now = new Date();

  try {
    if (maxParticipants > 0 && confirmedCount >= maxParticipants && !useWaiting) {
      return NextResponse.json(
        { error: "정원이 마감되어 참가 확정을 할 수 없습니다. 대기 등록이 필요하면 대회 규칙에서 대기자 허용을 설정하세요." },
        { status: 400 }
      );
    }

    const underCapacity = maxParticipants <= 0 || confirmedCount < maxParticipants;

    if (underCapacity) {
      await prisma.$transaction([
        prisma.tournamentEntry.update({
          where: { id: entryId },
          data: {
            status: "CONFIRMED",
            paidAt: now,
            reviewedAt: now,
            rejectionReason: null,
            waitingListOrder: null,
          },
        }),
        prisma.notification.create({
          data: {
            userId: entry.userId,
            message: "참가가 확정되었습니다. 대회 당일 출석 확인 및 권역 배정은 운영자 안내에 따라 진행해 주세요.",
          },
        }),
      ]);
      try {
        await sendPushToUser({
          userId: entry.userId,
          tournamentId,
          type: "ENTRY_APPROVED",
          title: "대회 참가가 확정되었습니다.",
          url: `/tournaments/${tournamentId}`,
        });
      } catch {
        // ignore
      }
      return NextResponse.json({ ok: true, result: "CONFIRMED" });
    }

    // 정원 초과 → 대기자 등록 (입금확인순으로 순번 부여)
    const lastWaiting = await prisma.tournamentEntry.findFirst({
      where: { tournamentId, status: "APPLIED", waitingListOrder: { not: null } },
      orderBy: { waitingListOrder: "desc" },
    });
    const nextOrder = (lastWaiting?.waitingListOrder ?? 0) + 1;

    await prisma.$transaction([
      prisma.tournamentEntry.update({
        where: { id: entryId },
        data: {
          paidAt: now,
          reviewedAt: now,
          waitingListOrder: nextOrder,
          rejectionReason: null,
        },
      }),
      prisma.notification.create({
        data: {
          userId: entry.userId,
          message: `대기 ${nextOrder}번으로 등록되었습니다. 확정 참가 취소 시 순번에 따라 자동 승격됩니다.`,
        },
      }),
    ]);
    try {
      await sendPushToUser({
        userId: entry.userId,
        tournamentId,
        type: "ENTRY_APPROVED",
        title: `대기 ${nextOrder}번으로 등록되었습니다.`,
        url: `/tournaments/${tournamentId}`,
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true, result: "WAITING", waitingListOrder: nextOrder });
  } catch (e) {
    console.error("confirm payment error", e);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
