import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { parseCommunityBoardTypeParam } from "../../../../lib/community-board-params";
import { getSiteCommunityConfig, listCommunityPosts } from "../../../../lib/surface-read";
import type { SiteCommunityBoardKey } from "../../../../lib/types/entities";
import { COMMUNITY_PRIMARY_TAB_LABEL, communityTabLabelForBoard, visibleCommunityBoardKeysForTabs } from "../community-tab-config";
import CommunityBoardPostList from "../CommunityBoardPostList";
import CommunityBoardSearchForm from "../CommunityBoardSearchForm";
import CommunityBoardTabs from "../CommunityBoardTabs";
import CommunityBoardSwipeShell from "../CommunityBoardSwipeShell";
import SiteShellFrame from "../../components/SiteShellFrame";
import SiteListPageSkeleton from "../../components/SiteListPageSkeleton";

const DEFAULT_COMMUNITY_TAB_ITEMS = [
  { key: "all" as const, label: "전체", href: "/site/community" },
  { key: "free" as const, label: COMMUNITY_PRIMARY_TAB_LABEL.free, href: "/site/community/free" },
  { key: "qna" as const, label: COMMUNITY_PRIMARY_TAB_LABEL.qna, href: "/site/community/qna" },
  { key: "reviews" as const, label: COMMUNITY_PRIMARY_TAB_LABEL.reviews, href: "/site/community/reviews" },
];

type Props = {
  params: Promise<{ boardType: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function SiteCommunityBoardListPage({ params, searchParams }: Props) {
  return (
    <SiteShellFrame
      brandTitle="커뮤니티"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <div className="ui-community-shell-context v3-stack" data-community-board="all">
          <CommunityBoardTabs tabs={DEFAULT_COMMUNITY_TAB_ITEMS} currentKey="all" />
          <CommunityBoardSearchForm actionPath="/site/community" inputId="community-q-all" defaultQuery="" />
        </div>
      }
    >
      <>
        <CommunityBoardSwipeShell tabs={DEFAULT_COMMUNITY_TAB_ITEMS.map(({ key, href }) => ({ key, href }))}>
          <Suspense
            fallback={
              <SiteListPageSkeleton brandTitle="커뮤니티" auxiliaryLabel="게시글 목록을 불러오는 중입니다." listRows={5} />
            }
          >
            <SiteCommunityBoardListContent params={params} searchParams={searchParams} />
          </Suspense>
        </CommunityBoardSwipeShell>
      </>
    </SiteShellFrame>
  );
}

async function SiteCommunityBoardListContent({ params, searchParams }: Props) {
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

  const listBoardLabel = communityTabLabelForBoard(boardType, config);

  const boardEmptyCopy: Partial<
    Record<SiteCommunityBoardKey, { emptyTitle: string; emptyDesc: string }>
  > = {
    free: {
      emptyTitle: "아직 게시글이 없습니다",
      emptyDesc: "가볍게 이야기나 정보를 남겨 보세요.",
    },
    qna: {
      emptyTitle: "등록된 질문이 없습니다",
      emptyDesc: "궁금한 점을 올리면 답변을 받을 수 있습니다.",
    },
    reviews: {
      emptyTitle: "아직 후기가 없습니다",
      emptyDesc: "대회나 연습 경험을 나눠 보세요.",
    },
  };
  const emptyProps = boardEmptyCopy[boardType];

  return (
    <>
      <section className="site-site-gray-main v3-stack ui-community-page" data-community-board={boardType}>
        <header className="ui-community-context-head">
          <p className="ui-community-context-head-label">{listBoardLabel}</p>
        </header>
        <CommunityBoardPostList showRoomPrefix={false} items={items} {...emptyProps} />
      </section>
      <Link href={writeHref} className="community-write-fab" aria-label={`${listBoardLabel} 글쓰기`}>
          <span aria-hidden>+</span>
        </Link>
    </>
  );
}
