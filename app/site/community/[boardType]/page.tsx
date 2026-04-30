import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { parseCommunityBoardTypeParam } from "../../../../lib/community-board-params";
import { getSiteCommunityConfig, listCommunityPostsForPublicSite } from "../../../../lib/surface-read";
import type { SiteCommunityBoardKey } from "../../../../lib/types/entities";
import { communityBoardListHref, communityNavTabsFromConfig } from "../community-tab-config";
import CommunityBoardPostList from "../CommunityBoardPostList";
import CommunityBoardSearchForm from "../CommunityBoardSearchForm";
import CommunityBoardTabs from "../CommunityBoardTabs";
import CommunityBoardSwipeShell from "../CommunityBoardSwipeShell";
import SiteShellFrame from "../../components/SiteShellFrame";
import SiteListPageSkeleton from "../../components/SiteListPageSkeleton";

type Props = {
  params: Promise<{ boardType: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SiteCommunityBoardListPage({ params, searchParams }: Props) {
  const { boardType: raw } = await params;
  const boardType = parseCommunityBoardTypeParam(raw);
  if (!boardType) notFound();

  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  const config = await getSiteCommunityConfig();
  const board = config[boardType];
  if (!board.visible) notFound();
  const navTabs = communityNavTabsFromConfig(config);

  return (
    <SiteShellFrame
      brandTitle="커뮤니티"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <div className="ui-community-shell-context v3-stack" data-community-board={boardType}>
          <CommunityBoardTabs tabs={navTabs} currentKey={boardType} />
          <CommunityBoardSearchForm
            actionPath={communityBoardListHref(boardType)}
            inputId={`community-q-${boardType}`}
            defaultQuery={q}
          />
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
            <SiteCommunityBoardListContent boardType={boardType} searchParams={searchParams} />
          </Suspense>
        </CommunityBoardSwipeShell>
        <Link
          href={`${communityBoardListHref(boardType)}/write`}
          className="community-write-fab"
          aria-label={`${boardType} 글쓰기`}
        >
          <span aria-hidden>+</span>
        </Link>
      </>
    </SiteShellFrame>
  );
}

async function SiteCommunityBoardListContent({
  boardType,
  searchParams,
}: {
  boardType: SiteCommunityBoardKey;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";

  const items = await listCommunityPostsForPublicSite(boardType, q ? { q } : undefined);

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
    <section className="site-site-gray-main v3-stack ui-community-page" data-community-board={boardType}>
      <CommunityBoardPostList showRoomPrefix={false} items={items} {...emptyProps} />
    </section>
  );
}
