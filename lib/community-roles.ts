import type { SessionUser } from "@/types/auth";

/** 커뮤니티 ADMIN: 공지 작성, 게시판/글 삭제, 권한 변경 */
export function isCommunityAdmin(session: SessionUser | null): boolean {
  return session?.role === "PLATFORM_ADMIN";
}

/** 커뮤니티 MODERATOR 이상: 신고 관리, 게시글/댓글 숨김 처리 */
export function isCommunityModerator(session: SessionUser | null): boolean {
  return session?.role === "MODERATOR" || session?.role === "PLATFORM_ADMIN";
}

/** 공지사항 글 작성: ADMIN(PLATFORM_ADMIN)만 */
export function canWriteNotice(session: SessionUser | null): boolean {
  return isCommunityAdmin(session);
}

/** 게시글/댓글 삭제(DB): ADMIN만. 숨김은 MODERATOR 가능 */
export function canDeletePostOrComment(session: SessionUser | null): boolean {
  return isCommunityAdmin(session);
}

/** 신고 관리·숨김 처리: MODERATOR 이상 */
export function canManageReports(session: SessionUser | null): boolean {
  return isCommunityModerator(session);
}
