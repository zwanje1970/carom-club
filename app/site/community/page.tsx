import { Suspense } from "react";

import { getDefaultSiteCommunityConfigForPublicSite } from "../../../lib/server/platform-backing-store";

import { getSiteCommunityConfig } from "../../../lib/surface-read";

import { communityNavTabsFromConfig } from "./community-tab-config";

import type { SiteCommunityConfig } from "../../../lib/types/entities";

import CommunityBoardListAreaClient from "./CommunityBoardListAreaClient";

import CommunityBoardSearchForm from "./CommunityBoardSearchForm";

import CommunityBoardTabs from "./CommunityBoardTabs";

import CommunityBoardSwipeShell from "./CommunityBoardSwipeShell";

import CommunityPageShellDiagMarker from "./CommunityPageShellDiagMarker";

import { createCommunityListLoadDiagServerLogger } from "../../../lib/site/community-load-diag";

import SiteShellFrame from "../components/SiteShellFrame";



export default function SiteCommunityPage({

  searchParams,

}: {

  searchParams?: Promise<Record<string, string | string[] | undefined>>;

}) {

  return (

    <Suspense fallback={null}>

      <SiteCommunityPageInner searchParams={searchParams} />

    </Suspense>

  );

}



async function SiteCommunityPageInner({

  searchParams,

}: {

  searchParams?: Promise<Record<string, string | string[] | undefined>>;

}) {

  const loadDiag = createCommunityListLoadDiagServerLogger("/site/community");

  loadDiag.log("page-render-start");

  const sp = searchParams ? await searchParams : {};

  const qRaw = sp.q;

  const q = typeof qRaw === "string" ? qRaw.trim() : Array.isArray(qRaw) ? String(qRaw[0] ?? "").trim() : "";



  let config: SiteCommunityConfig;

  try {

    config = await getSiteCommunityConfig();

  } catch (e) {

    console.error("[site/community] getSiteCommunityConfig failed", e);

    config = getDefaultSiteCommunityConfigForPublicSite();

  }

  const navTabs = communityNavTabsFromConfig(config);

  loadDiag.log("page-shell-rendered");



  return (

    <SiteShellFrame

      brandTitle="커뮤니티"

      auxiliaryBarClassName="site-shell-controls--site-list"

      auxiliary={

        <div className="ui-community-shell-context v3-stack" data-community-board="all">

          <CommunityBoardTabs tabs={navTabs} currentKey="all" />

          <CommunityBoardSearchForm actionPath="/site/community" inputId="community-q-all" defaultQuery={q} />

        </div>

      }

    >

      <>

        <CommunityPageShellDiagMarker />

        <CommunityBoardSwipeShell tabs={navTabs.map(({ key, href }) => ({ key, href }))}>

          <section className="site-site-gray-main v3-stack ui-community-page" data-community-board="all">

            <CommunityBoardListAreaClient

              boardListKey="all"

              searchParams={sp}

              scope="all"

              config={config}

              query={q || undefined}

              showRoomPrefix

            />

          </section>

        </CommunityBoardSwipeShell>

      </>

    </SiteShellFrame>

  );

}

