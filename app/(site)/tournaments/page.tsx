import { Suspense } from "react";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageRenderer } from "@/components/content/PageRenderer";
import { PageContentContainer } from "@/components/layout/PageContentContainer";
import { TournamentsPageChromeTitles } from "@/components/tournaments/TournamentsPageChromeTitles";
import type { AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { applyPublicHeroSingleCanonical } from "@/lib/content/filter-page-blocks-public-view";
import {
  getPublicTournamentsListFromQuery,
  parsePublicTournamentsQuery,
} from "@/lib/public-tournaments-list-request.server";
import { logServerTiming } from "@/lib/perf";
import { TournamentsListBlock } from "./TournamentsListBlock";
import { TournamentsListSkeleton } from "./TournamentsListSkeleton";

export const revalidate = 60;

async function TournamentsMainBody({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  console.time("tournaments_page_total");
  const t0 = Date.now();
  const parsed = parsePublicTournamentsQuery(searchParams);
  console.time("tournaments_page_common");
  const commonPromise = getCommonPageData("tournaments");
  console.time("tournaments_page_list");
  const listPromise = getPublicTournamentsListFromQuery(searchParams);
  const [common, listRes] = await Promise.all([
    commonPromise.finally(() => console.timeEnd("tournaments_page_common")),
    listPromise.finally(() => console.timeEnd("tournaments_page_list")),
  ]);
  logServerTiming("fetch_tournaments", t0);
  const { noticeBars, popups, pageBlocks, copy } = common;
  const pageBlocksRendered = applyPublicHeroSingleCanonical("tournaments", pageBlocks);
  const c = copy as Record<AdminCopyKey, string>;
  const hasTournamentListSlot = pageBlocksRendered.some((b) => b.slotType === "tournamentList");
  const initialHasMore = listRes.list.length === parsed.take;

  const slotContext = {
    page: "tournaments" as const,
    tournaments: {
      copy: c,
      initialList: listRes.list,
      initialHasMore,
      initialQuery: {
        tab: parsed.tab,
        sortBy: parsed.sortBy,
        national: parsed.nationalOnly,
      },
    },
  };
  console.timeEnd("tournaments_page_total");

  return (
    <>
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageRenderer blocks={pageBlocksRendered} slotContext={slotContext} />
      {!hasTournamentListSlot ? (
        <>
          <TournamentsPageChromeTitles copy={copy} />
          <TournamentsListBlock searchParams={searchParams} />
        </>
      ) : null}
    </>
  );
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <Suspense
        fallback={
          <PageContentContainer maxWidthClass="max-w-5xl">
            <TournamentsListSkeleton />
          </PageContentContainer>
        }
      >
        <TournamentsMainBody searchParams={sp} />
      </Suspense>
    </main>
  );
}
