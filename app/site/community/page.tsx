import { Suspense } from "react";
import { getDefaultSiteCommunityConfigForPublicSite } from "../../../lib/server/platform-backing-store";
import { getSiteCommunityConfig, listCommunityPostsAllPrimaryForPublicSite } from "../../../lib/surface-read";
import { communityNavTabsFromConfig, visibleCommunityBoardKeysForTabs } from "./community-tab-config";
import type { CommunityPostListItem, SiteCommunityConfig } from "../../../lib/types/entities";
import CommunityBoardPostList from "./CommunityBoardPostList";
import CommunityBoardListScrollShell from "./CommunityBoardListScrollShell";
import CommunityBoardSearchForm from "./CommunityBoardSearchForm";
import CommunityBoardTabs from "./CommunityBoardTabs";
import CommunityBoardSwipeShell from "./CommunityBoardSwipeShell";
import SiteHubRouteLoadingShell from "../components/SiteHubRouteLoadingShell";
import SiteShellFrame from "../components/SiteShellFrame";

function CommunityPageFallback() {
  return (
    <SiteHubRouteLoadingShell
      brandTitle="커뮤니티"
      auxiliaryBarClassName="site-shell-controls--site-list"
      sectionClassName="site-site-gray-main v3-stack ui-community-page"
    />
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

  let config: SiteCommunityConfig;
  try {
    config = await getSiteCommunityConfig();
  } catch (e) {
    console.error("[site/community] getSiteCommunityConfig failed", e);
    config = getDefaultSiteCommunityConfigForPublicSite();
  }
  const navTabs = communityNavTabsFromConfig(config);
  const visibleBoardKeys = visibleCommunityBoardKeysForTabs(config);
  let items: CommunityPostListItem[] = [];
  try {
    items = await listCommunityPostsAllPrimaryForPublicSite(visibleBoardKeys, q ? { q } : undefined);
  } catch (e) {
    console.error("[site/community] listCommunityPostsAllPrimaryForPublicSite failed", e);
  }

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
