import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { parseCommunityBoardTypeParam } from "../../../../lib/community-board-params";
import { getSiteCommunityConfig, getUserById, listCommunityPostsForPublicSite } from "../../../../lib/surface-read";
import { communityBoardListHref, communityNavTabsFromConfig, isCommunityNoticeBoard } from "../community-tab-config";
import CommunityBoardPostList from "../CommunityBoardPostList";
import CommunityBoardListScrollShell from "../CommunityBoardListScrollShell";
import CommunityBoardSearchForm from "../CommunityBoardSearchForm";
import CommunityBoardTabs from "../CommunityBoardTabs";
import CommunityBoardSwipeShell from "../CommunityBoardSwipeShell";
import SiteShellFrame from "../../components/SiteShellFrame";
import SiteDetailShellBodyLoader from "../../components/SiteDetailShellBodyLoader";

type Props = {
  params: Promise<{ boardType: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function CommunityBoardListFallback() {
  return (
    <SiteShellFrame brandTitle="커뮤니티" auxiliaryBarClassName="site-shell-controls--site-list">
      <SiteDetailShellBodyLoader />
    </SiteShellFrame>
  );
}

export default function SiteCommunityBoardListPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<CommunityBoardListFallback />}>
      <SiteCommunityBoardListPageInner params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SiteCommunityBoardListPageInner({ params, searchParams }: Props) {
  const [{ boardType: raw }, sp, config] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve<Record<string, string | string[] | undefined>>({}),
    getSiteCommunityConfig(),
  ]);
  const boardType = parseCommunityBoardTypeParam(raw);
  if (!boardType) notFound();
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";
  const board = config[boardType];
  if (!board.visible) notFound();
  const navTabs = communityNavTabsFromConfig(config);

  const items = await listCommunityPostsForPublicSite(boardType, q ? { q } : undefined);

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const user = session ? await getUserById(session.userId) : null;
  const isNoticeBoard = isCommunityNoticeBoard(boardType, config);
  const showWriteFab = !isNoticeBoard || user?.role === "PLATFORM";

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
          <section className="site-site-gray-main v3-stack ui-community-page" data-community-board={boardType}>
            <CommunityBoardListScrollShell boardListKey={boardType} searchParams={sp} itemsCount={items.length}>
              <CommunityBoardPostList showRoomPrefix={false} items={items} />
            </CommunityBoardListScrollShell>
          </section>
        </CommunityBoardSwipeShell>
        {showWriteFab ? (
          <Link
            prefetch={false}
            href={`${communityBoardListHref(boardType)}/write`}
            className="community-write-fab"
            aria-label={`${boardType} 글쓰기`}
          >
            <span aria-hidden>+</span>
          </Link>
        ) : null}
      </>
    </SiteShellFrame>
  );
}
