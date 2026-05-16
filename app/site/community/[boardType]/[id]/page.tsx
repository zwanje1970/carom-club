import { Suspense } from "react";
import { notFound } from "next/navigation";
import { parseCommunityBoardTypeParam } from "../../../../../lib/community-board-params";
import { getDefaultSiteCommunityConfigForPublicSite } from "../../../../../lib/server/platform-backing-store";
import { getSiteCommunityConfig } from "../../../../../lib/surface-read";
import type { SiteCommunityBoardKey } from "../../../../../lib/types/entities";
import SiteHeaderListBackLink from "../../../components/SiteHeaderListBackLink";
import SiteShellFrame from "../../../components/SiteShellFrame";
import { communityBoardListHref, communityBoardMobileHeaderTitle } from "../../community-tab-config";
import SiteCommunityPostDetailPageContent from "./SiteCommunityPostDetailPageContent";
import {
  CommunityDetailSuspenseFallback,
  CommunityLoadDiagConfigComplete,
  CommunityLoadDiagEnter,
} from "./community-load-diag-client";

type Props = {
  params: Promise<{ boardType: string; id: string }>;
};

export default async function SiteCommunityPostDetailPage({ params }: Props) {
  const { boardType: rawBoard, id: rawId } = await params;
  const boardType = parseCommunityBoardTypeParam(rawBoard);
  const postId = typeof rawId === "string" ? rawId.trim() : "";
  if (!boardType || !postId) notFound();

  let config;
  const pageConfigFetchStartMs = Date.now();
  try {
    config = await getSiteCommunityConfig();
  } catch {
    config = getDefaultSiteCommunityConfigForPublicSite();
  }
  const pageConfigFetchDurationMs = Date.now() - pageConfigFetchStartMs;
  const headerTitle = communityBoardMobileHeaderTitle(boardType, config);

  return (
    <SiteShellFrame
      brandLeading={
        <SiteHeaderListBackLink href={communityBoardListHref(boardType)} transition="community" />
      }
      brandTitle={
        <span className="site-community-detail-brand-name site-home-brand-ellipsis">{headerTitle}</span>
      }
    >
      <section className="site-site-gray-main v3-stack ui-community-post-detail-page">
        <CommunityLoadDiagEnter postId={postId} />
        <CommunityLoadDiagConfigComplete durationMs={pageConfigFetchDurationMs} />
        <Suspense
          fallback={<CommunityDetailSuspenseFallback fetchStarts={["config", "post"]} />}
        >
          <SiteCommunityPostDetailPageContent boardType={boardType as SiteCommunityBoardKey} postId={postId} />
        </Suspense>
      </section>
    </SiteShellFrame>
  );
}
