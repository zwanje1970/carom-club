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
  const t0 = Date.now();
  const parsed = parsePublicTournamentsQuery(searchParams);
  const [common, listRes] = await Promise.all([
    getCommonPageData("tournaments"),
    getPublicTournamentsListFromQuery(searchParams),
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
