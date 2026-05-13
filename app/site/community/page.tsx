import { Suspense } from "react";
import { getSiteCommunityConfig, listCommunityPostsAllPrimaryForPublicSite } from "../../../lib/surface-read";
import { communityNavTabsFromConfig, visibleCommunityBoardKeysForTabs } from "./community-tab-config";
import type { SiteCommunityConfig } from "../../../lib/types/entities";
import CommunityBoardPostList from "./CommunityBoardPostList";
import CommunityBoardListScrollShell from "./CommunityBoardListScrollShell";
import CommunityBoardSearchForm from "./CommunityBoardSearchForm";
import CommunityBoardTabs from "./CommunityBoardTabs";
import CommunityBoardSwipeShell from "./CommunityBoardSwipeShell";
import SiteShellFrame from "../components/SiteShellFrame";
import SiteListPageSkeleton from "../components/SiteListPageSkeleton";

function CommunityPageFallback() {
  return (
    <SiteShellFrame brandTitle="커뮤니티" auxiliaryBarClassName="site-shell-controls--site-list">
      <SiteListPageSkeleton contentOnly brandTitle="커뮤니티" auxiliaryLabel="" listRows={5} />
    </SiteShellFrame>
  );
}

export default function SiteCommunityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<CommunityPageFallback />}>
      <SiteCommunityPageInner searchParams={searchParams} />
    </Suspense>
  );
}

async function SiteCommunityPageInner({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  const config: SiteCommunityConfig = await getSiteCommunityConfig();
  const navTabs = communityNavTabsFromConfig(config);
  const visibleBoardKeys = visibleCommunityBoardKeysForTabs(config);
  const items = await listCommunityPostsAllPrimaryForPublicSite(visibleBoardKeys, q ? { q } : undefined);

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
          <section className="site-site-gray-main v3-stack ui-community-page" data-community-board="all">
            <CommunityBoardListScrollShell boardListKey="all" searchParams={sp} itemsCount={items.length}>
              <CommunityBoardPostList showRoomPrefix config={config} items={items} />
            </CommunityBoardListScrollShell>
          </section>
        </CommunityBoardSwipeShell>
      </>
    </SiteShellFrame>
  );
}
