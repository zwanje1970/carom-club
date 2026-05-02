import type { TournamentApplicationListItem } from "../../../../lib/types/entities";

const FILTER_KEYS = ["all", "approved", "wait", "reject"] as const;
export type ClientParticipantFilterKey = (typeof FILTER_KEYS)[number];

export function parseClientParticipantFilter(raw: string | undefined): ClientParticipantFilterKey {
  if (raw === "approved" || raw === "wait" || raw === "reject") return raw;
  return "all";
}

export function filterParticipantEntries(
  entries: TournamentApplicationListItem[],
  key: ClientParticipantFilterKey
): TournamentApplicationListItem[] {
  if (key === "approved") return entries.filter((e) => e.status === "APPROVED");
  if (key === "wait") return entries.filter((e) => e.status === "WAITING_PAYMENT");
  if (key === "reject") return entries.filter((e) => e.status === "REJECTED");
  return entries;
}

export function countParticipantApplications(entries: TournamentApplicationListItem[]) {
  return {
    all: entries.length,
    approved: entries.filter((e) => e.status === "APPROVED").length,
    wait: entries.filter((e) => e.status === "WAITING_PAYMENT").length,
    reject: entries.filter((e) => e.status === "REJECTED").length,
  };
}
