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

/** 모집 정원 충족 판단(목록 기준) — 대기자·거절 제외, 승인 처리·참가 확정 포함 */
export function countCapacityOccupiedFromListItems(entries: TournamentApplicationListItem[]): number {
  return entries.filter((e) => {
    if (e.status === "REJECTED" || e.status === "WAITING") return false;
    if (e.status === "APPROVED") return true;
    return typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim() !== "";
  }).length;
}

/** 참가 확정 전 — 운영 「신청 승인」 미완료 추정 건수 */
export function countPendingOperatorApplicationApproval(entries: TournamentApplicationListItem[]): number {
  return entries.filter((e) => {
    if (e.status === "REJECTED" || e.status === "APPROVED") return false;
    return !(typeof e.clientApplicationApprovedAt === "string" && e.clientApplicationApprovedAt.trim());
  }).length;
}

export function filterParticipantEntries(
  entries: TournamentApplicationListItem[],
  key: ClientParticipantFilterKey
): TournamentApplicationListItem[] {
  if (key === "approved") return entries.filter((e) => e.status === "APPROVED");
  if (key === "wait") return entries.filter(isApplicantBucket);
  if (key === "reject") return entries.filter((e) => e.status === "REJECTED");
  return entries;
}

export function countParticipantApplications(entries: TournamentApplicationListItem[]) {
  return {
    all: entries.length,
    approved: entries.filter((e) => e.status === "APPROVED").length,
    wait: entries.filter(isApplicantBucket).length,
    reject: entries.filter((e) => e.status === "REJECTED").length,
  };
}
