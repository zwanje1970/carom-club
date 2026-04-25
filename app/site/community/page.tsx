import { getSiteCommunityConfig, listCommunityPostsAllPrimary } from "../../../lib/surface-read";
import {
  communityTabLabelForBoard,
  visibleCommunityBoardKeysForTabs,
} from "./community-tab-config";
import CommunityBoardPostList from "./CommunityBoardPostList";
import CommunityBoardSearchForm from "./CommunityBoardSearchForm";
import CommunityBoardTabs from "./CommunityBoardTabs";
import CommunityBoardSwipeShell from "./CommunityBoardSwipeShell";
import SiteShellFrame from "../components/SiteShellFrame";

export default async function SiteCommunityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const config = await getSiteCommunityConfig();
  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  const visibleBoardKeys = visibleCommunityBoardKeysForTabs(config);
  const items = await listCommunityPostsAllPrimary(visibleBoardKeys, q ? { q } : undefined);

  const qSuffix = q ? `?q=${encodeURIComponent(q)}` : "";
  const tabItems = [
    { key: "all" as const, label: "전체", href: `/site/community${qSuffix}` },
    ...visibleBoardKeys.map((k) => ({
      key: k,
      label: communityTabLabelForBoard(k, config),
      href: `/site/community/${k}${qSuffix}`,
    })),
  ];

  return (
    <SiteShellFrame
      brandTitle="커뮤니티"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <div className="ui-community-shell-context v3-stack" data-community-board="all">
          <CommunityBoardTabs tabs={tabItems} currentKey="all" />
          <CommunityBoardSearchForm actionPath="/site/community" inputId="community-q-all" defaultQuery={q} />
        </div>
      }
    >
      <>
        <CommunityBoardSwipeShell tabs={tabItems.map(({ key, href }) => ({ key, href }))}>
          <section className="site-site-gray-main v3-stack ui-community-page" data-community-board="all">
            <header className="ui-community-context-head">
              <p className="ui-community-context-head-label">전체 게시판</p>
            </header>
            <CommunityBoardPostList showRoomPrefix items={items} />
          </section>
        </CommunityBoardSwipeShell>
      </>
    </SiteShellFrame>
  );
}
