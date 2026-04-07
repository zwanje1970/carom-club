import dynamic from "next/dynamic";
import { Suspense } from "react";
import { HomeHero } from "@/components/home/HomeHero";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageRenderer } from "@/components/content/PageRenderer";
import { HomeDeferredPopupLayer } from "@/components/home/HomeDeferredPopupLayer";
import { getCommonGlobalData } from "@/lib/common-page-data";
import { applyPublicHeroSingleCanonical } from "@/lib/content/filter-page-blocks-public-view";
import { buildHomeSlotRenderPayload } from "@/lib/home-slot-render-data.server";
import { resolveHeroSettingsForSlot } from "@/lib/hero-settings-defaults";
import { parseSlotBlockItemsBundle } from "@/lib/slot-block-items";
import { getNoticeBarsForPage, getOrderedPageBlocksForPage } from "@/lib/content/service";
import type { PageSection } from "@/types/page-section";

const HomeDeferredFooterOnly = dynamic(
  () => import("@/components/home/HomeDeferredFooterOnly").then((m) => m.HomeDeferredFooterOnly),
  { loading: () => null }
);
const HomeDeferredBlocks = dynamic(
  () => import("@/components/home/HomeDeferredBlocks").then((m) => m.HomeDeferredBlocks),
  { loading: () => null }
);

const HOME_IMMEDIATE_BLOCK_COUNT = 2;

function resolveHomeSlotDataNeeds(blocks: PageSection[]): { requireTournaments: boolean; requireVenues: boolean } {
  let requireTournaments = false;
  let requireVenues = false;
  for (const block of blocks) {
    if (block.slotType !== "tournamentIntro" && block.slotType !== "venueIntro") continue;
    const bundle = parseSlotBlockItemsBundle(block.sectionStyleJson, block.slotType);
    if (bundle.mode !== "auto") continue;
    if (bundle.publishedType === "tournament") requireTournaments = true;
    if (bundle.publishedType === "venue") requireVenues = true;
    if (requireTournaments && requireVenues) break;
  }
  return { requireTournaments, requireVenues };
}

/** 메인·대회·당구장 목록은 60초 캐시. 체감 속도 개선용 */
export const revalidate = 60;

/** 홈: `PageRenderer` 단일 스택 + 히어로 슬롯 보정. 구조 슬롯 데이터는 `buildHomeSlotRenderPayload`. */
export default async function HomePage() {
  const [{ copy, siteSettings }, noticeBars, pageBlocks] = await Promise.all([
    getCommonGlobalData(),
    getNoticeBarsForPage("home"),
    getOrderedPageBlocksForPage("home"),
  ]);
  const pageBlocksRendered = applyPublicHeroSingleCanonical("home", pageBlocks);
  const needs = resolveHomeSlotDataNeeds(pageBlocksRendered);
  const homeSlotPayload = await buildHomeSlotRenderPayload({
    copy,
    siteSettings,
    requireTournaments: needs.requireTournaments,
    requireVenues: needs.requireVenues,
    includeSessionFlags: false,
  });
  const hasHeroSlot = pageBlocksRendered.some((b) => b.slotType === "hero");
  const heroSettings = resolveHeroSettingsForSlot(siteSettings.heroSettings);
  const immediateBlocks = pageBlocksRendered.slice(0, HOME_IMMEDIATE_BLOCK_COUNT);
  const deferredBlocks = pageBlocksRendered.slice(HOME_IMMEDIATE_BLOCK_COUNT);

  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      {!hasHeroSlot ? <HomeHero heroSettings={heroSettings} /> : null}
      <ContentLayer noticeBars={noticeBars} />
      <PageRenderer
        blocks={immediateBlocks}
        slotContext={{ page: "home", heroSettings, home: homeSlotPayload }}
      />
      <HomeDeferredBlocks
        blocks={deferredBlocks}
        slotContext={{ page: "home", heroSettings, home: homeSlotPayload }}
      />
      <Suspense fallback={null}>
        <HomeDeferredPopupLayer />
      </Suspense>
      <HomeDeferredFooterOnly copy={copy} siteSettings={siteSettings} />
    </main>
  );
}
