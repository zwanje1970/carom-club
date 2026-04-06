import dynamic from "next/dynamic";
import { HomeHero } from "@/components/home/HomeHero";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageRenderer } from "@/components/content/PageRenderer";
import { getCommonPageData } from "@/lib/common-page-data";
import { applyPublicHeroSingleCanonical } from "@/lib/content/filter-page-blocks-public-view";
import { buildHomeSlotRenderPayload } from "@/lib/home-slot-render-data.server";
import { resolveHeroSettingsForSlot } from "@/lib/hero-settings-defaults";
import { getServerTiming, logServerTiming } from "@/lib/perf";

const HomeDeferredFooterOnly = dynamic(
  () => import("@/components/home/HomeDeferredFooterOnly").then((m) => m.HomeDeferredFooterOnly),
  { loading: () => null }
);

/** 메인·대회·당구장 목록은 60초 캐시. 체감 속도 개선용 */
export const revalidate = 60;

/** 홈: `PageRenderer` 단일 스택 + 히어로 슬롯 보정. 구조 슬롯 데이터는 `buildHomeSlotRenderPayload`. */
export default async function HomePage() {
  console.time("home_page_total");
  getServerTiming();
  console.time("home_main_query");
  const common = await getCommonPageData("home");
  console.timeEnd("home_main_query");
  const { copy, noticeBars, popups, pageBlocks, siteSettings } = common;
  const homeSlotPayload = await buildHomeSlotRenderPayload({ copy, siteSettings });
  const pageBlocksRendered = applyPublicHeroSingleCanonical("home", pageBlocks);
  const hasHeroSlot = pageBlocksRendered.some((b) => b.slotType === "hero");
  const heroSettings = resolveHeroSettingsForSlot(siteSettings.heroSettings);
  console.timeEnd("home_page_total");
  logServerTiming("fetch_sections");
  logServerTiming("page");

  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      {!hasHeroSlot ? <HomeHero heroSettings={heroSettings} /> : null}
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageRenderer
        blocks={pageBlocksRendered}
        slotContext={{ page: "home", heroSettings, home: homeSlotPayload }}
      />
      <HomeDeferredFooterOnly copy={copy} siteSettings={siteSettings} />
    </main>
  );
}
