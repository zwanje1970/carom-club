import { getCommonPageData } from "@/lib/common-page-data";
import { getSession } from "@/lib/auth";
import { canManageReports } from "@/lib/community-roles";
import {
  getLegacyFallbackPermissions,
  PERMISSION_KEYS,
  type PermissionSubject,
} from "@/lib/auth/permissions";
import { CommunityMainClient } from "./CommunityMainClient";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getCachedCommunityLatest } from "@/lib/community-home-data";

async function canShowCommunityHomeSolverEntry(
  session: PermissionSubject
): Promise<boolean> {
  if (!session) return false;
  if (!session.roleId) {
    return getLegacyFallbackPermissions(session.role).includes(
      PERMISSION_KEYS.COMMUNITY_POST_CREATE
    );
  }

  const { hasPermission } = await import("@/lib/auth/permissions.server");
  return hasPermission(session, PERMISSION_KEYS.COMMUNITY_POST_CREATE);
}

export async function CommunityHomeInner({
  category,
}: {
  category: "all" | "free" | "qna" | "notice";
}) {
  const [common, session] = await Promise.all([getCommonPageData("community"), getSession()]);
  const { noticeBars, popups, pageSections } = common;
  const canManageReports_ = canManageReports(session);

  // 기본 커뮤니티 허브에서는 legacy trouble 글을 숨기고 nangu 전용 목록으로 진입시킨다.
  const latest = await getCachedCommunityLatest(true);

  const showSolverEntry = await canShowCommunityHomeSolverEntry(session);

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageSectionsRenderer sections={pageSections} />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <CommunityMainClient
          latest={latest}
          initialCategory={category}
          canManageReports={canManageReports_}
          showSolverEntry={showSolverEntry}
        />
      </div>
    </main>
  );
}
