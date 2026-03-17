import { NextResponse } from "next/server";
import { revokeTournamentCancel } from "@/lib/community-score-service";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";
import { sendPushToUser } from "@/lib/push/sendPush";

/** 관리자: 참가 신청 취소 처리. 확정 취소 시 대기 1순위 자동 승격 및 순번 갱신 */
export async function POST(
  _request: Request,
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
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (entry.status === "CANCELED") {
    return NextResponse.json({ error: "이미 취소된 신청입니다." }, { status: 400 });
  }
  if (entry.status === "REJECTED") {
    return NextResponse.json({ error: "거절된 신청은 취소로 변경할 수 없습니다." }, { status: 400 });
  }

  const wasConfirmed = entry.status === "CONFIRMED";
  let promotedUserId: string | null = null;

  try {
    if (wasConfirmed) {
      await prisma.$transaction(async (tx) => {
        await tx.tournamentEntry.update({
          where: { id: entryId },
          data: { status: "CANCELED" },
        });

        const firstWaiting = await tx.tournamentEntry.findFirst({
          where: {
            tournamentId,
            status: "APPLIED",
            waitingListOrder: { not: null },
          },
          orderBy: { waitingListOrder: "asc" },
        });

        if (firstWaiting) {
          promotedUserId = firstWaiting.userId;
          await tx.tournamentEntry.update({
            where: { id: firstWaiting.id },
            data: { status: "CONFIRMED", waitingListOrder: null },
          });
          await tx.notification.create({
            data: {
              userId: firstWaiting.userId,
              message: "대기에서 참가 확정으로 승격되었습니다.",
            },
          });
        }

        const remainingWaitlist = await tx.tournamentEntry.findMany({
          where: {
            tournamentId,
            status: "APPLIED",
            waitingListOrder: { not: null },
          },
          orderBy: { waitingListOrder: "asc" },
        });

        for (let i = 0; i < remainingWaitlist.length; i++) {
          await tx.tournamentEntry.update({
            where: { id: remainingWaitlist[i].id },
            data: { waitingListOrder: i + 1 },
          });
        }
      });

      if (promotedUserId) {
        try {
          await sendPushToUser({
            userId: promotedUserId,
            tournamentId,
            type: "ENTRY_APPROVED",
            title: "대기에서 참가 확정으로 승격되었습니다.",
            url: `/tournaments/${tournamentId}`,
          });
        } catch {
          // ignore
        }
      }
    } else {
      await prisma.tournamentEntry.update({
        where: { id: entryId },
        data: { status: "CANCELED" },
      });

      const wasWaiting = entry.waitingListOrder != null;
      if (wasWaiting) {
        const remainingWaitlist = await prisma.tournamentEntry.findMany({
          where: {
            tournamentId,
            status: "APPLIED",
            waitingListOrder: { not: null },
          },
          orderBy: { waitingListOrder: "asc" },
        });
        for (let i = 0; i < remainingWaitlist.length; i++) {
          await prisma.tournamentEntry.update({
            where: { id: remainingWaitlist[i].id },
            data: { waitingListOrder: i + 1 },
          });
        }
      }
    }

    try {
      await revokeTournamentCancel(entry.userId, entryId);
    } catch (_) {}

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin cancel entry error", e);
    return NextResponse.json(
      { error: "취소 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
