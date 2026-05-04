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

function CommunityBoardListFallback() {
  return (
    <SiteShellFrame brandTitle="커뮤니티" auxiliaryBarClassName="site-shell-controls--site-list">
      <SiteListPageSkeleton
        contentOnly
        brandTitle="커뮤니티"
        auxiliaryLabel="게시글 목록을 불러오는 중입니다."
        listRows={5}
      />
    </SiteShellFrame>
  );
}

export default function SiteCommunityBoardListPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<CommunityBoardListFallback />}>
      <SiteCommunityBoardListPageResolved params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SiteCommunityBoardListPageResolved({ params, searchParams }: Props) {
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
          prefetch={false}
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

  return (
    <section className="site-site-gray-main v3-stack ui-community-page" data-community-board={boardType}>
      <CommunityBoardPostList showRoomPrefix={false} items={items} />
    </section>
  );
}
