import type { PageSection } from "@/types/page-section";

/**
 * 레거시 폴백 제거 **준비** 판별용(실제 분기 제거는 별도 작업).
 * 빌더가 로드한 전체 행 기준 — 공개 노출 필터와는 별개.
 */

export function hasCommunityPostListSlot(rows: PageSection[]): boolean {
  return rows.some((r) => r.page === "community" && r.slotType === "postList");
}

export function hasTournamentsTournamentListSlot(rows: PageSection[]): boolean {
  return rows.some((r) => r.page === "tournaments" && r.slotType === "tournamentList");
}
