import { getCommonPageData } from "@/lib/common-page-data";
import { getSession } from "@/lib/auth";
import { canManageReports } from "@/lib/community-roles";
import { CommunityMainClient } from "./CommunityMainClient";
import { isPlatformAdmin } from "@/types/auth";
import { canShowSolverEntry } from "@/lib/entry-visibility";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getCachedCommunityLatest } from "@/lib/community-home-data";

export async function CommunityHomeInner({
  category,
}: {
  category: "all" | "free" | "qna" | "trouble" | "notice";
}) {
  const [common, session] = await Promise.all([getCommonPageData("community"), getSession()]);
  const { noticeBars, popups, pageSections } = common;
  const canManageReports_ = canManageReports(session);

  const latest = await getCachedCommunityLatest(!session);

  const showSolverEntry = canShowSolverEntry(isPlatformAdmin(session));

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
