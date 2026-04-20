import { notFound } from "next/navigation";
import Link from "next/link";
import {
  COMMUNITY_PRIMARY_BOARD_KEYS,
  getSiteCommunityConfig,
  listCommunityPosts,
  parseCommunityBoardTypeParam,
  type SiteCommunityBoardKey,
} from "../../../../lib/server/dev-store";
import CommunityBoardPostList from "../CommunityBoardPostList";
import CommunityBoardSearchForm from "../CommunityBoardSearchForm";
import CommunityBoardTabs from "../CommunityBoardTabs";
import SiteShellFrame from "../../components/SiteShellFrame";

const PRIMARY_TAB_LABEL = {
  free: "자유",
  qna: "질문",
  reviews: "대회후기",
  extra1: "구인구직",
} as const;

type PrimaryTabKey = keyof typeof PRIMARY_TAB_LABEL;

function isPrimaryTabKey(k: SiteCommunityBoardKey): k is PrimaryTabKey {
  return k in PRIMARY_TAB_LABEL;
}

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
  const tabItems = COMMUNITY_PRIMARY_BOARD_KEYS.filter((k) => config[k].visible).map((k) => ({
    key: k,
    label: PRIMARY_TAB_LABEL[k as PrimaryTabKey],
    href: `/site/community/${k}${qSuffix}`,
  }));

  return (
    <SiteShellFrame brandTitle="커뮤니티">
      <section className="site-site-gray-main v3-stack ui-community-page ui-community-board-hub">
        <CommunityBoardTabs tabs={tabItems} currentKey={boardType} />
        <CommunityBoardSearchForm boardType={boardType} defaultQuery={q} />
        <CommunityBoardPostList
          boardType={boardType}
          boardLabel={isPrimaryTabKey(boardType) ? PRIMARY_TAB_LABEL[boardType] : board.label}
          items={items}
        />
        <Link href={writeHref} className="community-write-fab" aria-label="글쓰기">
          <span aria-hidden>+</span>
        </Link>
      </section>
    </SiteShellFrame>
  );
}
