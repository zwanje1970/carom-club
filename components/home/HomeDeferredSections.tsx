import { HomeSectionsWithLocation } from "@/components/home/HomeSectionsWithLocation";
import { HomeNoticeCommunity } from "@/components/home/HomeNoticeCommunity";
import { SiteFooter } from "@/components/layout/SiteFooter";
import Link from "next/link";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getTournamentsListRaw, getVenuesForCarousel, type TournamentListRow, type VenueCarouselRow } from "@/lib/db-tournaments";
import { MOCK_TOURNAMENTS_LIST, MOCK_VENUES_LIST } from "@/lib/mock-data";
import { logServerTiming } from "@/lib/perf";
import type { SiteSettings } from "@/lib/site-settings";

/** 초기 페인트 후 스트리밍: DB(대회/당구장)만 조회해 하단 섹션 렌더. 첫 화면 블로킹 제거용. */
export async function HomeDeferredSections({
  copy,
  siteSettings,
}: {
  copy: Record<string, string>;
  siteSettings: SiteSettings;
}) {
  const dbStart = Date.now();
  let tournaments: TournamentListRow[] = [];
  let carouselVenues: VenueCarouselRow[] = [];

  if (isDatabaseConfigured()) {
    const [tList, cList] = await Promise.all([
      getTournamentsListRaw({ orderBy: "asc", take: 4 }),
      getVenuesForCarousel(50),
    ]);
    tournaments = tList.length > 0 ? tList : (MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[]);
    carouselVenues = cList;
  } else {
    tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
    carouselVenues = MOCK_VENUES_LIST.map((v, i) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      logoImageUrl: null as string | null,
      coverImageUrl: null as string | null,
      venueCategory: (i === 0 ? "daedae_only" : "mixed") as VenueCarouselRow["venueCategory"],
    }));
  }
  logServerTiming("db", dbStart);

  return (
    <>
      <HomeSectionsWithLocation
        initialTournaments={tournaments}
        copy={copy}
        carouselVenues={carouselVenues}
        homeCarouselFlowSpeed={siteSettings.homeCarouselFlowSpeed}
      />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-wrap gap-4 justify-center text-sm">
        <Link href="/venues" className="text-site-primary hover:underline font-medium">
          당구장 전체 보기 →
        </Link>
      </div>
      <HomeNoticeCommunity copy={copy} />
      {/* 모바일 메인: 하단 푸터 생략(하단 탭 네비와 겹침·화면 단순화) */}
      <div className="hidden md:block">
        <SiteFooter
          footer={siteSettings.footer}
          defaultTagline={copy["site.footer.tagline"] ?? undefined}
        />
      </div>
    </>
  );
}
