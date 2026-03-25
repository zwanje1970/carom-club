import { Suspense } from "react";
import { HomeHero } from "@/components/home/HomeHero";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { HomeDeferredSections } from "@/components/home/HomeDeferredSections";
import { HomeSectionsSkeleton } from "@/components/home/HomeSectionsSkeleton";
import { getCommonPageData } from "@/lib/common-page-data";
import { getHeroSettings } from "@/lib/hero-settings";
import { heroFromSection } from "@/lib/content/hero-from-section";
import { getServerTiming, logServerTiming } from "@/lib/perf";

/** 메인·대회·당구장 목록은 60초 캐시. 체감 속도 개선용 */
export const revalidate = 60;

/** 즉시 표시: 공통 데이터 1회 조회(cache 60s) + 히어로 설정. DB(대회/당구장)는 Suspense로 후속 로딩. */
export default async function HomePage() {
  getServerTiming();
  const [common, heroSettings] = await Promise.all([
    getCommonPageData("home"),
    getHeroSettings(),
  ]);
  const { copy, noticeBars, popups, pageSections, siteSettings } = common;
  logServerTiming("fetch_sections");
  const heroSection = pageSections.find(
    (s) => s.placement === "main_visual_bg" && s.type === "image"
  );
  const heroData = heroSection ? heroFromSection(heroSection, copy) : null;
  const otherSections = heroSection
    ? pageSections.filter((s) => s.id !== heroSection.id)
    : pageSections;
  logServerTiming("page");

  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      <HomeHero copy={copy} hero={heroData} heroSettings={heroSettings} />
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      <PageSectionsRenderer sections={otherSections} />

      {/* DB(대회/당구장)는 스트리밍으로 후속 로딩 → 첫 페인트 블로킹 제거 */}
      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeDeferredSections copy={copy} siteSettings={siteSettings} />
      </Suspense>
    </main>
  );
}
