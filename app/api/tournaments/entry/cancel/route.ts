import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { sendPushToUser } from "@/lib/push/sendPush";

/** 참가 신청 취소. 확정 참가 취소 시 대기 1순위 자동 승격 및 대기순번 갱신 */
export async function POST(request: Request) {
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

  const body = await request.json();
  const { entryId } = body as { entryId?: string };
  if (!entryId) {
    return NextResponse.json({ error: "entryId가 필요합니다." }, { status: 400 });
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, userId: session.id },
    include: { tournament: { include: { rule: true } } },
  });
  if (!entry) {
    return NextResponse.json({ error: "참가 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  if (entry.status === "CANCELED") {
    return NextResponse.json({ error: "이미 취소되었거나 불참 처리된 신청입니다." }, { status: 400 });
  }
  if (entry.status === "REJECTED") {
    return NextResponse.json({ error: "반려된 신청은 취소할 수 없습니다." }, { status: 400 });
  }

  const tournamentId = entry.tournamentId;
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
              message: "대기에서 참가 확정으로 승격되었습니다. 대회 당일 출석 확인 및 권역 배정은 운영자 안내에 따라 진행해 주세요.",
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("cancel error", e);
    return NextResponse.json(
      { error: "취소 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
