import { HomeHero } from "@/components/home/HomeHero";
import { HomeSectionsWithLocation } from "@/components/home/HomeSectionsWithLocation";
import { HomeQuickApply } from "@/components/home/HomeQuickApply";
import { HomeNoticeCommunity } from "@/components/home/HomeNoticeCommunity";
import { HomeLocation } from "@/components/home/HomeLocation";
import { ContentLayer } from "@/components/content/ContentLayer";
import { PageSectionsRenderer } from "@/components/content/PageSectionsRenderer";
import { getAdminCopy } from "@/lib/admin-copy";
import { getHeroSettings } from "@/lib/hero-settings";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { heroFromSection } from "@/lib/content/hero-from-section";
import {
  getNoticeBarsForPage,
  getPopupsForPage,
  getPageSectionsForPage,
} from "@/lib/content/service";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getTournamentsListRaw, getVenuesListRaw, type TournamentListRow } from "@/lib/db-tournaments";
import { MOCK_TOURNAMENTS_LIST, MOCK_VENUES_LIST } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [copy, noticeBars, popups, pageSections, heroSettings, siteSettings] = await Promise.all([
    getAdminCopy(),
    getNoticeBarsForPage("home"),
    getPopupsForPage("home"),
    getPageSectionsForPage("home"),
    getHeroSettings(),
    getSiteSettings(),
  ]);
  const heroSection = pageSections.find(
    (s) => s.placement === "main_visual_bg" && s.type === "image"
  );
  const heroData = heroSection ? heroFromSection(heroSection, copy) : null;
  const otherSections = heroSection
    ? pageSections.filter((s) => s.id !== heroSection.id)
    : pageSections;
  let tournaments: TournamentListRow[] = [];
  let venues: { id: string; name: string; slug: string }[] = [];

  if (isDatabaseConfigured()) {
    const [tList, vList] = await Promise.all([
      getTournamentsListRaw({ orderBy: "asc", take: 6 }),
      getVenuesListRaw(6),
    ]);
    tournaments = tList.length > 0 ? tList : (MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[]);
    venues = vList.length > 0 ? vList : MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug }));
  } else {
    tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
    venues = MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug }));
  }

  return (
    <main className="min-h-screen bg-[var(--site-bg)] text-site-text">
      <ContentLayer noticeBars={noticeBars} popups={popups} />
      {/* 1. Hero 배너 (관리자 > 설정 > 메인 히어로 설정 우선, 없으면 페이지 섹션) */}
      <HomeHero copy={copy} hero={heroData} heroSettings={heroSettings} />

      {/* CMS 페이지 섹션 (관리자 > 콘텐츠 관리 > 페이지 섹션) */}
      <PageSectionsRenderer sections={otherSections} />

      {/* 4. 진행중 대회 카드 · 5. 당구장 소개 (위치 기준 가까운 순 정렬) */}
      <HomeSectionsWithLocation
        initialVenues={venues}
        initialTournaments={tournaments}
        copy={copy}
      />

      {/* 6. 빠른 참가 신청 */}
      <HomeQuickApply copy={copy} />

      {/* 7. 공지 / 커뮤니티 */}
      <HomeNoticeCommunity copy={copy} />

      {/* 8. 위치 안내 */}
      <HomeLocation copy={copy} />

      <SiteFooter
        footer={siteSettings.footer}
        defaultTagline={copy["site.footer.tagline"] ?? undefined}
      />
    </main>
  );
}
