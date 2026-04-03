import { getCommonPageData } from "@/lib/common-page-data";
import { applyPublicHeroSingleCanonical } from "@/lib/content/filter-page-blocks-public-view";
import { buildCommunityHomeSlotCommunityPayload } from "@/lib/community-home-slot-context.server";
import { CommunityMainClient } from "./CommunityMainClient";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageRenderer } from "@/components/content/PageRenderer";
import { PageContentContainer } from "@/components/layout/PageContentContainer";

export async function CommunityHomeInner({
  category,
}: {
  category: "all" | "free" | "qna" | "notice";
}) {
  console.time("community_home_total");
  console.time("community_home_main_query");
  const [common, communityPayload] = await Promise.all([
    getCommonPageData("community"),
    buildCommunityHomeSlotCommunityPayload(category),
  ]);
  console.timeEnd("community_home_main_query");
  const { noticeBars, popups, pageBlocks, copy } = common;
  const pageBlocksRendered = applyPublicHeroSingleCanonical("community", pageBlocks);
  const hasPostListSlot = pageBlocksRendered.some((b) => b.slotType === "postList");

  const slotContext = {
    page: "community" as const,
    community: { ...communityPayload, copy },
  };
  console.timeEnd("community_home_total");

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageRenderer blocks={pageBlocksRendered} slotContext={slotContext} />
      {!hasPostListSlot ? (
        <PageContentContainer className="py-6">
          <CommunityMainClient
            key={category}
            copy={copy}
            latest={communityPayload.latest}
            initialCategory={category}
            canManageReports={communityPayload.canManageReports}
            showSolverEntry={communityPayload.showSolverEntry}
          />
        </PageContentContainer>
      ) : null}
    </main>
  );
}
