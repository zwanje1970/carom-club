import { Suspense } from "react";
import { getSiteCommunityConfig, listCommunityPostsAllPrimary } from "../../../lib/surface-read";
import {
  COMMUNITY_PRIMARY_TAB_LABEL,
  communityTabLabelForBoard,
  visibleCommunityBoardKeysForTabs,
} from "./community-tab-config";
import CommunityBoardPostList from "./CommunityBoardPostList";
import CommunityBoardSearchForm from "./CommunityBoardSearchForm";
import CommunityBoardTabs from "./CommunityBoardTabs";
import CommunityBoardSwipeShell from "./CommunityBoardSwipeShell";
import SiteShellFrame from "../components/SiteShellFrame";
import SiteListPageSkeleton from "../components/SiteListPageSkeleton";

const DEFAULT_COMMUNITY_TAB_ITEMS = [
  { key: "all" as const, label: "전체", href: "/site/community" },
  { key: "free" as const, label: COMMUNITY_PRIMARY_TAB_LABEL.free, href: "/site/community/free" },
  { key: "qna" as const, label: COMMUNITY_PRIMARY_TAB_LABEL.qna, href: "/site/community/qna" },
  { key: "reviews" as const, label: COMMUNITY_PRIMARY_TAB_LABEL.reviews, href: "/site/community/review" },
  { key: "extra1" as const, label: "구인구직", href: "/site/community/jobs" },
];

export default async function SiteCommunityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  return (
    <SiteShellFrame
      brandTitle="커뮤니티"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <div className="ui-community-shell-context v3-stack" data-community-board="all">
          <CommunityBoardTabs tabs={DEFAULT_COMMUNITY_TAB_ITEMS} currentKey="all" />
          <CommunityBoardSearchForm actionPath="/site/community" inputId="community-q-all" defaultQuery={q} />
        </div>
      }
    >
      <>
        <header className="ui-community-context-head">
          <p className="ui-community-context-head-label">전체 게시판</p>
        </header>
        <CommunityBoardSwipeShell tabs={DEFAULT_COMMUNITY_TAB_ITEMS.map(({ key, href }) => ({ key, href }))}>
          <Suspense
            fallback={
              <SiteListPageSkeleton brandTitle="커뮤니티" auxiliaryLabel="게시글 목록을 불러오는 중입니다." listRows={5} />
            }
          >
            <SiteCommunityPageContent searchParams={searchParams} />
          </Suspense>
        </CommunityBoardSwipeShell>
      </>
    </SiteShellFrame>
  );
}

async function SiteCommunityPageContent({
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

  return (
    <section className="site-site-gray-main v3-stack ui-community-page" data-community-board="all">
      <CommunityBoardPostList showRoomPrefix items={items} />
    </section>
  );
}
