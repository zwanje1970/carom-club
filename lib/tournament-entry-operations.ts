/**
 * 대회 참가 신청(TournamentEntry) 운영 처리 — admin / client API 공용.
 * 권한 검증은 호출 측에서 수행합니다.
 */
import { revokeTournamentCancel } from "@/lib/community-score-service";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/sendPush";
import { isParticipantRosterLocked, ROSTER_LOCKED_ENTRY_ERROR } from "@/lib/tournament-roster-lock";
import { syncNationalWaitlistEntries } from "@/lib/tournaments/national";
import { syncLeagueEntriesForTournamentEntry } from "@/lib/league-service";

export type EntryOpFail = { ok: false; error: string; status: number };
export type EntryOpOk<T = Record<string, unknown>> = { ok: true } & T;

export async function confirmTournamentEntryPayment(
  tournamentId: string,
  entryId: string
): Promise<EntryOpOk<{ result: "CONFIRMED" | "WAITING"; waitingListOrder?: number }> | EntryOpFail> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { rule: true },
  });
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다.", status: 404 };
  }
  if (tournament.status === "BRACKET_GENERATED") {
    return {
      ok: false,
      error: "대진표가 생성된 후에는 참가 확정/반려를 변경할 수 없습니다.",
      status: 400,
    };
  }
  if (await isParticipantRosterLocked(tournamentId)) {
    return { ok: false, error: ROSTER_LOCKED_ENTRY_ERROR, status: 409 };
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) {
    return { ok: false, error: "참가 신청을 찾을 수 없습니다.", status: 404 };
  }
  if (entry.status !== "APPLIED") {
    return { ok: false, error: "신청 상태가 아니거나 이미 처리되었습니다.", status: 400 };
  }
  if (entry.paymentMarkedByApplicantAt == null) {
    return {
      ok: false,
      error: "신청자가 '입금 완료'를 체크한 건만 입금확인할 수 있습니다.",
      status: 400,
    };
  }
  if (entry.paidAt != null) {
    return {
      ok: false,
      error: "이미 입금확인된 신청입니다. 중복 처리되지 않습니다.",
      status: 400,
    };
  }

  const maxParticipants = tournament.maxParticipants ?? tournament.rule?.maxEntries ?? 0;
  const confirmedCount = await prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  const useWaiting = tournament.rule?.useWaiting ?? false;
  const now = new Date();

  try {
    if (maxParticipants > 0 && confirmedCount >= maxParticipants && !useWaiting) {
      return {
        ok: false,
        error:
          "정원이 마감되어 참가 확정을 할 수 없습니다. 대기 등록이 필요하면 대회 규칙에서 대기자 허용을 설정하세요.",
        status: 400,
      };
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
            isWaitlist: false,
          },
        }),
        prisma.notification.create({
          data: {
            userId: entry.userId,
            message:
              "참가가 확정되었습니다. 대회 당일 출석 확인 및 권역 배정은 운영자 안내에 따라 진행해 주세요.",
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
      await syncNationalWaitlistEntries(tournamentId);
      await syncLeagueEntriesForTournamentEntry({
        tournamentId,
        tournamentEntryId: entryId,
        nextStatus: "CONFIRMED",
      });
      return { ok: true, result: "CONFIRMED" };
    }

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
          isWaitlist: true,
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
    await syncNationalWaitlistEntries(tournamentId);
    return { ok: true, result: "WAITING", waitingListOrder: nextOrder };
  } catch (e) {
    console.error("[confirmTournamentEntryPayment]", e);
    return { ok: false, error: "처리 중 오류가 발생했습니다.", status: 500 };
  }
}

export async function cancelTournamentEntryWithWaitlist(
  tournamentId: string,
  entryId: string
): Promise<EntryOpOk | EntryOpFail> {
  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) {
    return { ok: false, error: "참가 신청을 찾을 수 없습니다.", status: 404 };
  }
  if (entry.status === "CANCELED") {
    return { ok: false, error: "이미 취소된 신청입니다.", status: 400 };
  }
  if (entry.status === "REJECTED") {
    return { ok: false, error: "거절된 신청은 취소로 변경할 수 없습니다.", status: 400 };
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
      await syncNationalWaitlistEntries(tournamentId);

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
      await syncNationalWaitlistEntries(tournamentId);
    }

    try {
      await revokeTournamentCancel(entry.userId, entryId);
    } catch {
      // ignore
    }

    return { ok: true };
  } catch (e) {
    console.error("[cancelTournamentEntryWithWaitlist]", e);
    return { ok: false, error: "취소 처리 중 오류가 발생했습니다.", status: 500 };
  }
}

export async function rejectTournamentEntryApplied(
  tournamentId: string,
  entryId: string,
  rejectionReason: string | null
): Promise<EntryOpOk<{ status: "REJECTED" }> | EntryOpFail> {
  if (await isParticipantRosterLocked(tournamentId)) {
    return { ok: false, error: ROSTER_LOCKED_ENTRY_ERROR, status: 409 };
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, status: true },
  });
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다.", status: 404 };
  }
  if (tournament.status === "BRACKET_GENERATED") {
    return {
      ok: false,
      error: "대진표가 생성된 후에는 참가 확정/반려를 변경할 수 없습니다.",
      status: 400,
    };
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) {
    return { ok: false, error: "참가 신청을 찾을 수 없습니다.", status: 404 };
  }
  if (entry.status !== "APPLIED") {
    return { ok: false, error: "신청됨 상태만 반려할 수 있습니다.", status: 400 };
  }

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
    // ignore
  }

  return { ok: true, status: "REJECTED" };
}

/** 대기열(입금확인 완료·정원 초과) → 수동 승격 */
export async function promoteWaitingTournamentEntry(
  tournamentId: string,
  entryId: string
): Promise<EntryOpOk | EntryOpFail> {
  if (await isParticipantRosterLocked(tournamentId)) {
    return { ok: false, error: ROSTER_LOCKED_ENTRY_ERROR, status: 409 };
  }
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { rule: true },
  });
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다.", status: 404 };
  }
  if (tournament.status === "BRACKET_GENERATED") {
    return {
      ok: false,
      error: "대진표가 생성된 후에는 대기 승격을 할 수 없습니다.",
      status: 400,
    };
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, tournamentId },
  });
  if (!entry) {
    return { ok: false, error: "참가 신청을 찾을 수 없습니다.", status: 404 };
  }
  if (entry.status !== "APPLIED" || entry.waitingListOrder == null || entry.paidAt == null) {
    return {
      ok: false,
      error: "대기(입금확인 완료) 상태의 신청만 승격할 수 있습니다.",
      status: 400,
    };
  }

  const maxParticipants = tournament.maxParticipants ?? tournament.rule?.maxEntries ?? 0;
  const confirmedCount = await prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });
  if (maxParticipants > 0 && confirmedCount >= maxParticipants) {
    return { ok: false, error: "정원이 찼습니다. 확정 취소 후 승격해 주세요.", status: 400 };
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.tournamentEntry.update({
        where: { id: entryId },
        data: {
          status: "CONFIRMED",
          waitingListOrder: null,
          reviewedAt: now,
          isWaitlist: false,
        },
      });
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
    await syncNationalWaitlistEntries(tournamentId);

    await prisma.notification.create({
      data: {
        userId: entry.userId,
        message: "대기에서 참가 확정으로 승격되었습니다.",
      },
    });
    try {
      await sendPushToUser({
        userId: entry.userId,
        tournamentId,
        type: "ENTRY_APPROVED",
        title: "대기에서 참가 확정으로 승격되었습니다.",
        url: `/tournaments/${tournamentId}`,
      });
    } catch {
      // ignore
    }

    return { ok: true };
  } catch (e) {
    console.error("[promoteWaitingTournamentEntry]", e);
    return { ok: false, error: "승격 처리 중 오류가 발생했습니다.", status: 500 };
  }
}
