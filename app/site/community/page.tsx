import Link from "next/link";
import { getSiteCommunityConfig, listCommunityPostsAllPrimary } from "../../../lib/server/dev-store";
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

  const firstVisible = visibleBoardKeys[0];
  const writeHref = firstVisible ? `/site/community/${firstVisible}/write` : "/site";

  return (
    <SiteShellFrame
      brandTitle="커뮤니티"
      auxiliary={
        <>
          <CommunityBoardTabs tabs={tabItems} currentKey="all" />
          <CommunityBoardSearchForm actionPath="/site/community" inputId="community-q-all" defaultQuery={q} />
        </>
      }
    >
      <CommunityBoardSwipeShell tabs={tabItems.map(({ key, href }) => ({ key, href }))}>
        <section className="site-site-gray-main v3-stack ui-community-page">
          <CommunityBoardPostList showRoomPrefix items={items} />
          <Link href={writeHref} className="community-write-fab" aria-label="글쓰기">
            <span aria-hidden>+</span>
          </Link>
        </section>
      </CommunityBoardSwipeShell>
    </SiteShellFrame>
  );
}
