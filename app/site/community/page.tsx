import Link from "next/link";
import {
  COMMUNITY_PRIMARY_BOARD_KEYS,
  getSiteCommunityConfig,
  listCommunityPostsAllPrimary,
} from "../../../lib/server/dev-store";
import { COMMUNITY_PRIMARY_TAB_LABEL } from "./community-tab-config";
import CommunityBoardPostList from "./CommunityBoardPostList";
import CommunityBoardSearchForm from "./CommunityBoardSearchForm";
import CommunityBoardTabs from "./CommunityBoardTabs";
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

  const visibleKeys = COMMUNITY_PRIMARY_BOARD_KEYS.filter((k) => config[k].visible);
  const items = await listCommunityPostsAllPrimary(visibleKeys, q ? { q } : undefined);

  const qSuffix = q ? `?q=${encodeURIComponent(q)}` : "";
  const tabItems = [
    { key: "all" as const, label: "전체", href: `/site/community${qSuffix}` },
    ...COMMUNITY_PRIMARY_BOARD_KEYS.filter((k) => config[k].visible).map((k) => ({
      key: k,
      label: COMMUNITY_PRIMARY_TAB_LABEL[k as keyof typeof COMMUNITY_PRIMARY_TAB_LABEL],
      href: `/site/community/${k}${qSuffix}`,
    })),
  ];

  const firstVisible = COMMUNITY_PRIMARY_BOARD_KEYS.find((k) => config[k].visible);
  const writeHref = firstVisible ? `/site/community/${firstVisible}/write` : "/site";

  return (
    <SiteShellFrame brandTitle="커뮤니티">
      <section className="site-site-gray-main v3-stack ui-community-page ui-community-board-hub">
        <CommunityBoardTabs tabs={tabItems} currentKey="all" />
        <CommunityBoardSearchForm actionPath="/site/community" inputId="community-q-all" defaultQuery={q} />
        <CommunityBoardPostList showRoomPrefix items={items} />
        <Link href={writeHref} className="community-write-fab" aria-label="글쓰기">
          <span aria-hidden>+</span>
        </Link>
      </section>
    </SiteShellFrame>
  );
}
