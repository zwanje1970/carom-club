import { Suspense } from "react";
import { notFound } from "next/navigation";
import { parseCommunityBoardTypeParam } from "../../../../lib/community-board-params";
import { getDefaultSiteCommunityConfigForPublicSite } from "../../../../lib/server/platform-backing-store";
import { getSiteCommunityConfig } from "../../../../lib/surface-read";
import {
  communityBoardListHref,
  communityNavTabsFromConfig,
  isCommunityNoticeBoard,
} from "../community-tab-config";
import CommunityBoardListAreaClient from "../CommunityBoardListAreaClient";
import CommunityBoardSearchForm from "../CommunityBoardSearchForm";
import CommunityBoardTabs from "../CommunityBoardTabs";
import CommunityBoardSwipeShell from "../CommunityBoardSwipeShell";
import CommunityPageShellDiagMarker from "../CommunityPageShellDiagMarker";
import CommunityWriteFabClient from "../CommunityWriteFabClient";
import { createCommunityListLoadDiagServerLogger } from "../../../../lib/site/community-load-diag";
import SiteShellFrame from "../../components/SiteShellFrame";
import type { SiteCommunityConfig } from "../../../../lib/types/entities";

type Props = {
  params: Promise<{ boardType: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function SiteCommunityBoardListPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <SiteCommunityBoardListPageInner params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SiteCommunityBoardListPageInner({ params, searchParams }: Props) {
  const [{ boardType: raw }, sp] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);
  const loadDiag = createCommunityListLoadDiagServerLogger(`/site/community/${raw}`);
  loadDiag.log("page-render-start");
  let config: SiteCommunityConfig;
  try {
    config = await getSiteCommunityConfig();
  } catch (e) {
    console.error("[site/community/board] getSiteCommunityConfig failed", e);
    config = getDefaultSiteCommunityConfigForPublicSite();
  }
  const boardType = parseCommunityBoardTypeParam(raw);
  if (!boardType) notFound();
  const qRaw = sp.q;
  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";
  const board = config[boardType];
  if (!board.visible) notFound();
  const navTabs = communityNavTabsFromConfig(config);
  const isNoticeBoard = isCommunityNoticeBoard(boardType, config);
  const listHeaderTitle = isNoticeBoard ? "공지사항" : "커뮤니티";
  loadDiag.log("page-shell-rendered", { boardType });

  return (
    <SiteShellFrame
      brandTitle={listHeaderTitle}
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
        <CommunityPageShellDiagMarker />
        <CommunityBoardSwipeShell tabs={navTabs.map(({ key, href }) => ({ key, href }))}>
          <section className="site-site-gray-main v3-stack ui-community-page" data-community-board={boardType}>
            <CommunityBoardListAreaClient
              boardListKey={boardType}
              searchParams={sp}
              scope={boardType}
              config={config}
              query={q || undefined}
              showRoomPrefix={false}
            />
          </section>
        </CommunityBoardSwipeShell>
        <CommunityWriteFabClient boardType={boardType} isNoticeBoard={isNoticeBoard} />
      </>
    </SiteShellFrame>
  );
}
