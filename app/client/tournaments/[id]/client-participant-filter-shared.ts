import type { TournamentApplicationListItem } from "../../../../lib/types/entities";

const FILTER_KEYS = ["all", "approved", "wait", "reject"] as const;
export type ClientParticipantFilterKey = (typeof FILTER_KEYS)[number];

export function parseClientParticipantFilter(raw: string | undefined): ClientParticipantFilterKey {
  if (raw === "approved" || raw === "wait" || raw === "reject") return raw;
  return "all";
}

function isApplicantBucket(e: TournamentApplicationListItem): boolean {
  return (
    e.status === "APPLIED" ||
    e.status === "VERIFYING" ||
    e.status === "WAITING_PAYMENT" ||
    e.status === "WAITING"
  );
}

export function isProcessingCancelledEntry(e: TournamentApplicationListItem): boolean {
  return typeof e.clientApplicationCancelledAt === "string" && e.clientApplicationCancelledAt.trim() !== "";
}

/** 모집 정원 충족 판단(목록 기준) — 대기자·거절·취소 제외, 승인 처리·참가 확정 포함 */
export function countCapacityOccupiedFromListItems(entries: TournamentApplicationListItem[]): number {
  return entries.filter((e) => {
    if (isProcessingCancelledEntry(e)) return false;
    if (e.status === "REJECTED" || e.status === "WAITING") return false;
    if (e.status === "APPROVED") return true;
    return typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim() !== "";
  }).length;
}

/** 신청자관리 취소 칩 — processing 취소 토글 + 기존 REJECTED(거절) */
export function countApplicationCancelledChip(entries: TournamentApplicationListItem[]): number {
  return entries.filter((e) => isProcessingCancelledEntry(e) || e.status === "REJECTED").length;
}

/** 신청자관리 승인 칩 — 취소 상태 제외 */
export function countApplicationApprovedChip(entries: TournamentApplicationListItem[]): number {
  return entries.filter((e) => {
    if (isProcessingCancelledEntry(e)) return false;
    if (e.status === "APPROVED") return true;
    return typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim() !== "";
  }).length;
}

/** 참가 확정 전 — 운영 「신청 승인」 미완료 추정 건수 */
export function countPendingOperatorApplicationApproval(entries: TournamentApplicationListItem[]): number {
  return entries.filter((e) => {
    if (isProcessingCancelledEntry(e)) return false;
    if (e.status === "REJECTED" || e.status === "APPROVED") return false;
    return !(typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim());
  }).length;
}

/**
 * 확정리스트(참가 확정자) — Firestore `status === "APPROVED"`인 건만.
 * 운영 화면의 신청 승인(`clientApplicationApprovedAt`)·입금확인만으로는 포함하지 않습니다.
 */
export function filterConfirmedParticipantEntries<T extends { status: string }>(entries: readonly T[]): T[] {
  return entries.filter((e) => e.status === "APPROVED");
}

export function filterParticipantEntries(
  entries: TournamentApplicationListItem[],
  key: ClientParticipantFilterKey
): TournamentApplicationListItem[] {
  if (key === "approved") return filterConfirmedParticipantEntries(entries);
  if (key === "wait") return entries.filter(isApplicantBucket);
  if (key === "reject") return entries.filter((e) => isProcessingCancelledEntry(e) || e.status === "REJECTED");
  return entries;
}

export function countParticipantApplications(entries: TournamentApplicationListItem[]) {
  return {
    all: entries.length,
    approved: filterConfirmedParticipantEntries(entries).length,
    wait: entries.filter(isApplicantBucket).length,
    reject: countApplicationCancelledChip(entries),
  };
}
