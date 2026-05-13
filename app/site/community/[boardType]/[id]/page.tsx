import { Suspense } from "react";
import { notFound } from "next/navigation";
import { parseCommunityBoardTypeParam } from "../../../../../lib/community-board-params";
import type { SiteCommunityBoardKey } from "../../../../../lib/types/entities";
import SiteShellFrame from "../../../components/SiteShellFrame";
import SiteDetailShellBodyLoader from "../../../components/SiteDetailShellBodyLoader";
import SiteCommunityPostDetailPageContent from "./SiteCommunityPostDetailPageContent";

type Props = {
  params: Promise<{ boardType: string; id: string }>;
};

export default async function SiteCommunityPostDetailPage({ params }: Props) {
  const { boardType: rawBoard, id: rawId } = await params;
  const boardType = parseCommunityBoardTypeParam(rawBoard);
  const postId = typeof rawId === "string" ? rawId.trim() : "";
  if (!boardType || !postId) notFound();

  return (
    <SiteShellFrame
      brandTitle={
        <span className="site-community-detail-brand-name site-home-brand-ellipsis">게시글</span>
      }
    >
      <section className="site-site-gray-main v3-stack ui-community-post-detail-page">
        <Suspense fallback={<SiteDetailShellBodyLoader />}>
          <SiteCommunityPostDetailPageContent boardType={boardType as SiteCommunityBoardKey} postId={postId} />
        </Suspense>
      </section>
    </SiteShellFrame>
  );
}
