import { Suspense } from "react";
import { getSiteCommunityConfig, listCommunityPostsAllPrimary } from "../../../lib/surface-read";
import { communityNavTabsFromConfig, visibleCommunityBoardKeysForTabs } from "./community-tab-config";
import type { SiteCommunityConfig } from "../../../lib/types/entities";
import CommunityBoardPostList from "./CommunityBoardPostList";
import CommunityBoardSearchForm from "./CommunityBoardSearchForm";
import CommunityBoardTabs from "./CommunityBoardTabs";
import CommunityBoardSwipeShell from "./CommunityBoardSwipeShell";
import SiteShellFrame from "../components/SiteShellFrame";
import SiteListPageSkeleton from "../components/SiteListPageSkeleton";

export default async function SiteCommunityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  const config = await getSiteCommunityConfig();
  const navTabs = communityNavTabsFromConfig(config);

  return (
    <SiteShellFrame
      brandTitle="커뮤니티"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <div className="ui-community-shell-context v3-stack" data-community-board="all">
          <CommunityBoardTabs tabs={navTabs} currentKey="all" />
          <CommunityBoardSearchForm actionPath="/site/community" inputId="community-q-all" defaultQuery={q} />
        </div>
      }
    >
      <>
        <CommunityBoardSwipeShell tabs={navTabs.map(({ key, href }) => ({ key, href }))}>
          <Suspense
            fallback={
              <SiteListPageSkeleton
                contentOnly
                brandTitle="커뮤니티"
                auxiliaryLabel="게시글 목록을 불러오는 중입니다."
                listRows={5}
              />
            }
          >
            <SiteCommunityPageContent config={config} searchParams={searchParams} />
          </Suspense>
        </CommunityBoardSwipeShell>
      </>
    </SiteShellFrame>
  );
}

async function SiteCommunityPageContent({
  config,
  searchParams,
}: {
  config: SiteCommunityConfig;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  const visibleBoardKeys = visibleCommunityBoardKeysForTabs(config);
  const items = await listCommunityPostsAllPrimary(visibleBoardKeys, q ? { q } : undefined);

  return (
    <section className="site-site-gray-main v3-stack ui-community-page" data-community-board="all">
      <CommunityBoardPostList showRoomPrefix config={config} items={items} />
    </section>
  );
}
