import "server-only";

import { getSession } from "@/lib/auth";
import {
  getLegacyFallbackPermissions,
  PERMISSION_KEYS,
  type PermissionSubject,
} from "@/lib/auth/permissions";
import { canManageReports } from "@/lib/community-roles";
import { getCachedCommunityLatest } from "@/lib/community-home-data";
import type { CommunityHubPostItem } from "@/types/page-slot-render-context";

async function canShowCommunityHomeSolverEntry(session: PermissionSubject): Promise<boolean> {
  if (!session) return false;
  if (!session.roleId) {
    return getLegacyFallbackPermissions(session.role).includes(PERMISSION_KEYS.COMMUNITY_POST_CREATE);
  }
  const { hasPermission } = await import("@/lib/auth/permissions.server");
  return hasPermission(session, PERMISSION_KEYS.COMMUNITY_POST_CREATE);
}

/** 커뮤니티 허브 `PageRenderer`용 slotContext.community — 공개·미리보기 동일 로직 */
export async function buildCommunityHomeSlotCommunityPayload(
  category: "all" | "free" | "qna" | "notice"
): Promise<{
  latest: CommunityHubPostItem[];
  initialCategory: typeof category;
  canManageReports: boolean;
  showSolverEntry: boolean;
}> {
  const [session, latest] = await Promise.all([getSession(), getCachedCommunityLatest(true)]);
  const canManageReports_ = canManageReports(session);
  const showSolverEntry = await canShowCommunityHomeSolverEntry(session);
  return {
    latest,
    initialCategory: category,
    canManageReports: canManageReports_,
    showSolverEntry,
  };
}
