import { notFound } from "next/navigation";
import Link from "next/link";
import {
  COMMUNITY_PRIMARY_BOARD_KEYS,
  getSiteCommunityConfig,
  listCommunityPosts,
  parseCommunityBoardTypeParam,
  type SiteCommunityBoardKey,
} from "../../../../lib/server/dev-store";
import { COMMUNITY_PRIMARY_TAB_LABEL, isPrimaryTabKey } from "../community-tab-config";
import CommunityBoardPostList from "../CommunityBoardPostList";
import CommunityBoardSearchForm from "../CommunityBoardSearchForm";
import CommunityBoardTabs from "../CommunityBoardTabs";
import CommunityBoardSwipeShell from "../CommunityBoardSwipeShell";
import SiteShellFrame from "../../components/SiteShellFrame";

type Props = {
  params: Promise<{ boardType: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SiteCommunityBoardListPage({ params, searchParams }: Props) {
  const { boardType: raw } = await params;
  const boardType = parseCommunityBoardTypeParam(raw);
  if (!boardType) notFound();

  const config = await getSiteCommunityConfig();
  const board = config[boardType as SiteCommunityBoardKey];
  if (!board.visible) notFound();

  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  const items = await listCommunityPosts(boardType, q ? { q } : undefined);

  const writeHref = `/site/community/${boardType}/write`;

  const qSuffix = q ? `?q=${encodeURIComponent(q)}` : "";
  const tabItems = [
    { key: "all" as const, label: "전체", href: `/site/community${qSuffix}` },
    ...COMMUNITY_PRIMARY_BOARD_KEYS.filter((k) => config[k].visible).map((k) => ({
      key: k,
      label: COMMUNITY_PRIMARY_TAB_LABEL[k as keyof typeof COMMUNITY_PRIMARY_TAB_LABEL],
      href: `/site/community/${k}${qSuffix}`,
    })),
  ];

  const listBoardLabel = isPrimaryTabKey(boardType) ? COMMUNITY_PRIMARY_TAB_LABEL[boardType] : board.label;

  return (
    <SiteShellFrame
      brandTitle="커뮤니티"
      auxiliary={
        <>
          <CommunityBoardTabs tabs={tabItems} currentKey={boardType} />
          <CommunityBoardSearchForm
            actionPath={`/site/community/${boardType}`}
            inputId={`community-q-${boardType}`}
            defaultQuery={q}
          />
        </>
      }
    >
      <CommunityBoardSwipeShell tabs={tabItems.map(({ key, href }) => ({ key, href }))}>
        <section className="site-site-gray-main v3-stack ui-community-page">
          <CommunityBoardPostList showRoomPrefix={false} items={items} />
          <Link href={writeHref} className="community-write-fab" aria-label={`${listBoardLabel} 글쓰기`}>
            <span aria-hidden>+</span>
          </Link>
        </section>
      </CommunityBoardSwipeShell>
    </SiteShellFrame>
  );
}
