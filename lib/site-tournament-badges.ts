/**
 * 사이트 메인 슬라이드 / 대회안내 목록 / 클라이언트 게시 UI에서 공통으로 쓰는 상태 배지 규칙.
 * (스냅샷·대회 엔티티 구조는 바꾸지 않고, 표시·게시 조건만 맞춘다.)
 */

/** 메인 홈 슬라이드(홍보): 참여 가능한 상태만 */
export const MAIN_SLIDE_STATUS_BADGES = new Set<string>(["모집중", "마감임박", "대기자모집"]);

/** 대회 상태 문자열 기준으로 메인 슬라이드 게시 노출 여부(저장 시점에 카드에 반영) */
export function tournamentStatusEligibleForMainSlide(status: string): boolean {
  return MAIN_SLIDE_STATUS_BADGES.has(status.trim());
}

/** /site/tournaments 공개 목록에서 숨김 (생성자 전용 상태) */
export const SITE_TOURNAMENT_LIST_EXCLUDED_BADGES = new Set<string>(["초안", "예정"]);

/** 카드 게시(저장·게시 흐름) 허용 상태 */
export const PUBLISH_ELIGIBLE_STATUS_BADGES = new Set<string>(["모집중", "마감임박", "대기자모집"]);

export function resolveTournamentStatusBadgeForDisplay(
  snapshotBadge: string | undefined | null,
  tournamentBadge: string | undefined | null
): string {
  const fromSnap = typeof snapshotBadge === "string" ? snapshotBadge.trim() : "";
  const fromTour = typeof tournamentBadge === "string" ? tournamentBadge.trim() : "";
  return (fromSnap || fromTour || "초안").trim();
}

export function isHiddenFromMainSlideByBadge(effectiveBadge: string): boolean {
  return !MAIN_SLIDE_STATUS_BADGES.has(effectiveBadge.trim());
}

/** 게시 가능하면 null, 아니면 사용자 안내 문구 */
export function getPublishBlockedUserMessage(status: string): string | null {
  const s = status.trim();
  if (PUBLISH_ELIGIBLE_STATUS_BADGES.has(s)) return null;
  switch (s) {
    case "초안":
      return "초안은 게시할 수 없습니다.";
    case "예정":
      return "예정 상태는 게시할 수 없습니다.";
    case "마감":
      return "마감된 경기는 게시할 수 없습니다.";
    case "종료":
      return "종료된 경기는 게시할 수 없습니다.";
    default:
      return "이 상태에서는 게시할 수 없습니다.";
  }
}
