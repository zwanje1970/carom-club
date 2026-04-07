import { Suspense } from "react";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { applyPublicHeroSingleCanonical } from "@/lib/content/filter-page-blocks-public-view";
import { getNoticeBarsForPage, getOrderedPageBlocksForPage } from "@/lib/content/service";
import { buildCommunityHomeSlotCommunityPayload } from "@/lib/community-home-slot-context.server";
import { CommunityMainClient } from "./CommunityMainClient";
import { CommunityDeferredPopupLayer } from "@/components/community/CommunityDeferredPopupLayer";
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
  const [copy, noticeBars, pageBlocks, communityPayload] = await Promise.all([
    getAdminCopy(),
    getNoticeBarsForPage("community"),
    getOrderedPageBlocksForPage("community"),
    buildCommunityHomeSlotCommunityPayload(category),
  ]);
  console.timeEnd("community_home_main_query");
  const pageBlocksRendered = applyPublicHeroSingleCanonical("community", pageBlocks);
  const hasPostListSlot = pageBlocksRendered.some((b) => b.slotType === "postList");

  const slotContext = {
    page: "community" as const,
    community: { ...communityPayload, copy },
  };
  console.timeEnd("community_home_total");

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <ContentLayer noticeBars={noticeBars} />
      <PageRenderer blocks={pageBlocksRendered} slotContext={slotContext} />
      {!hasPostListSlot ? (
        <PageContentContainer className="py-6">
          <CommunityMainClient
            key={category}
            latest={communityPayload.latest}
            initialCategory={category}
            showSolverEntry={communityPayload.showSolverEntry}
          />
        </PageContentContainer>
      ) : null}
      <Suspense fallback={null}>
        <CommunityDeferredPopupLayer />
      </Suspense>
    </main>
  );
}
