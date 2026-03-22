/**
 * 대진표 생성 전 "참가 명단 확정" — 스냅샷·요약·잠금.
 * 잠금 후: tournament-entry-operations 및 대진표 생성 시 스냅샷 일치 검증.
 */
import { prisma } from "@/lib/db";
import { promoteWaitingTournamentEntry } from "@/lib/tournament-entry-operations";

export { ROSTER_LOCKED_ENTRY_ERROR } from "@/lib/tournament-roster-lock";

export type ParticipantRosterSnapshotV1 = {
  version: 1;
  entryIds: string[];
  userIds: string[];
  summary: {
    totalActiveApplicants: number;
    confirmedCount: number;
    waitingCount: number;
    duplicateSuspectEntryCount: number;
    canceledOrRejectedCount: number;
    appliedPaymentPendingCount: number;
  };
  lockedAt: string;
  lockedByUserId: string;
};

function normalizeDepositorKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim().toLowerCase().replace(/\s+/g, " ");
  return t.length >= 2 ? t : null;
}

/** 스냅샷과 현재 DB의 CONFIRMED 목록이 다르면 대진표 생성 불가 */
export async function validateConfirmedEntriesMatchRosterSnapshot(
  tournamentId: string,
  currentConfirmedEntryIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantRosterSnapshot: true, participantRosterLockedAt: true },
  });
  /** 명단 확정 절차 도입 이전 대회: 잠금 없으면 스냅샷 검사 생략(기존 CLOSED만으로 생성 가능) */
  if (!t?.participantRosterLockedAt) {
    return { ok: true };
  }
  if (!t.participantRosterSnapshot?.trim()) {
    return { ok: false, error: "참가 명단이 확정 처리되었으나 스냅샷이 없습니다. 플랫폼 관리자에게 문의하세요." };
  }
  let snap: ParticipantRosterSnapshotV1;
  try {
    snap = JSON.parse(t.participantRosterSnapshot) as ParticipantRosterSnapshotV1;
  } catch {
    return { ok: false, error: "참가 명단 스냅샷이 손상되었습니다. 플랫폼 관리자에게 문의하세요." };
  }
  if (snap.version !== 1 || !Array.isArray(snap.entryIds)) {
    return { ok: false, error: "참가 명단 스냅샷 형식이 올바르지 않습니다." };
  }
  const a = [...snap.entryIds].sort().join("\0");
  const b = [...currentConfirmedEntryIds].sort().join("\0");
  if (a !== b) {
    return {
      ok: false,
      error:
        "확정 스냅샷과 현재 참가 확정자 목록이 일치하지 않습니다. 데이터가 임의 변경되었을 수 있어 대진표를 생성할 수 없습니다.",
    };
  }
  return { ok: true };
}

export type ParticipantRosterSummary = {
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: string;
  maxParticipants: number | null;
  useWaiting: boolean;
  participantRosterLockedAt: string | null;
  snapshot: ParticipantRosterSnapshotV1 | null;
  totalActiveApplicants: number;
  confirmedCount: number;
  waitingCount: number;
  appliedPaymentPendingCount: number;
  canceledOrRejectedCount: number;
  duplicateSuspectEntryCount: number;
  duplicateSuspectSamples: { entryIds: string[]; depositorKey: string; userNames: string[] }[];
  /** 정원 대비 확정 슬롯 (CONFIRMED 행 수) */
  projectedConfirmedAfterPromoteAll: number;
};

export async function computeParticipantRosterSummary(tournamentId: string): Promise<ParticipantRosterSummary | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      rule: true,
      entries: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!tournament) return null;

  const maxParticipants = tournament.maxParticipants ?? tournament.rule?.maxEntries ?? null;
  const useWaiting = tournament.rule?.useWaiting ?? false;

  let snap: ParticipantRosterSnapshotV1 | null = null;
  if (tournament.participantRosterSnapshot?.trim()) {
    try {
      const p = JSON.parse(tournament.participantRosterSnapshot) as ParticipantRosterSnapshotV1;
      if (p?.version === 1 && Array.isArray(p.entryIds)) snap = p;
    } catch {
      snap = null;
    }
  }

  const entries = tournament.entries;
  const canceledOrRejectedCount = entries.filter((e) => e.status === "CANCELED" || e.status === "REJECTED").length;
  const confirmed = entries.filter((e) => e.status === "CONFIRMED");
  const waiting = entries.filter((e) => e.status === "APPLIED" && e.waitingListOrder != null && e.paidAt != null);
  /** 입금관리자 확인 전(또는 신청자 입금표시 전) — 명단 확정 전 정리 대상 */
  const appliedPaymentPendingCount = entries.filter(
    (e) => e.status === "APPLIED" && e.paidAt == null
  ).length;

  const totalActiveApplicants = entries.filter(
    (e) => e.status === "APPLIED" || e.status === "CONFIRMED"
  ).length;

  const confirmedCount = confirmed.length;
  const waitingCount = waiting.length;

  // 중복 의심: 동일 입금자명(정규화) + 서로 다른 userId + CONFIRMED
  const byDep = new Map<string, typeof confirmed>();
  for (const e of confirmed) {
    const k = normalizeDepositorKey(e.depositorName);
    if (!k) continue;
    const list = byDep.get(k) ?? [];
    list.push(e);
    byDep.set(k, list);
  }
  let duplicateSuspectEntryCount = 0;
  const duplicateSuspectSamples: ParticipantRosterSummary["duplicateSuspectSamples"] = [];
  for (const [depositorKey, list] of byDep) {
    const userIds = new Set(list.map((x) => x.userId));
    if (userIds.size <= 1) continue;
    duplicateSuspectEntryCount += list.length;
    if (duplicateSuspectSamples.length < 8) {
      duplicateSuspectSamples.push({
        depositorKey,
        entryIds: list.map((x) => x.id),
        userNames: list.map((x) => x.user.name),
      });
    }
  }

  let projectedConfirmedAfterPromoteAll = confirmedCount;
  if (maxParticipants != null && maxParticipants > 0) {
    const spare = Math.max(0, maxParticipants - confirmedCount);
    projectedConfirmedAfterPromoteAll = confirmedCount + Math.min(spare, waitingCount);
  } else {
    projectedConfirmedAfterPromoteAll = confirmedCount + waitingCount;
  }

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    tournamentStatus: tournament.status,
    maxParticipants: maxParticipants != null && maxParticipants > 0 ? maxParticipants : null,
    useWaiting,
    participantRosterLockedAt: tournament.participantRosterLockedAt?.toISOString() ?? null,
    snapshot: snap,
    totalActiveApplicants,
    confirmedCount,
    waitingCount,
    appliedPaymentPendingCount,
    canceledOrRejectedCount,
    duplicateSuspectEntryCount,
    duplicateSuspectSamples,
    projectedConfirmedAfterPromoteAll,
  };
}

/** 정원 내에서 대기(입금확인) 순으로 전원 승격 시도 */
export async function promoteAllEligibleWaitlist(tournamentId: string): Promise<{ promoted: number; lastError?: string }> {
  let promoted = 0;
  let lastError: string | undefined;
  for (;;) {
    const first = await prisma.tournamentEntry.findFirst({
      where: {
        tournamentId,
        status: "APPLIED",
        waitingListOrder: { not: null },
        paidAt: { not: null },
      },
      orderBy: { waitingListOrder: "asc" },
    });
    if (!first) break;
    const r = await promoteWaitingTournamentEntry(tournamentId, first.id);
    if (!r.ok) {
      lastError = r.error;
      break;
    }
    promoted++;
  }
  return { promoted, lastError };
}

export async function lockParticipantRoster(params: {
  tournamentId: string;
  lockedByUserId: string;
  /** false면 대회 status를 건드리지 않음 (기본 true = CLOSED로 맞춤) */
  closeRegistration?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { tournamentId, lockedByUserId, closeRegistration = true } = params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { rule: true },
  });
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다.", status: 404 };
  }
  if (tournament.status === "BRACKET_GENERATED") {
    return { ok: false, error: "이미 대진표가 생성된 대회입니다.", status: 400 };
  }
  if (tournament.participantRosterLockedAt != null) {
    return { ok: false, error: "이미 참가 명단이 확정되었습니다.", status: 400 };
  }

  const confirmed = await prisma.tournamentEntry.findMany({
    where: { tournamentId, status: "CONFIRMED" },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, userId: true },
  });
  if (confirmed.length < 1) {
    return { ok: false, error: "참가 확정자가 1명 이상 있어야 명단을 확정할 수 있습니다.", status: 400 };
  }

  const summaryFull = await computeParticipantRosterSummary(tournamentId);
  if (!summaryFull) {
    return { ok: false, error: "대회를 찾을 수 없습니다.", status: 404 };
  }

  const snapshot: ParticipantRosterSnapshotV1 = {
    version: 1,
    entryIds: confirmed.map((e) => e.id),
    userIds: confirmed.map((e) => e.userId),
    summary: {
      totalActiveApplicants: summaryFull.totalActiveApplicants,
      confirmedCount: summaryFull.confirmedCount,
      waitingCount: summaryFull.waitingCount,
      duplicateSuspectEntryCount: summaryFull.duplicateSuspectEntryCount,
      canceledOrRejectedCount: summaryFull.canceledOrRejectedCount,
      appliedPaymentPendingCount: summaryFull.appliedPaymentPendingCount,
    },
    lockedAt: new Date().toISOString(),
    lockedByUserId,
  };

  const now = new Date();
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      participantRosterLockedAt: now,
      participantRosterSnapshot: JSON.stringify(snapshot),
      ...(closeRegistration ? { status: "CLOSED" } : {}),
    },
  });

  return { ok: true };
}
