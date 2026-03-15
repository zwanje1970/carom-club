import { HomeSectionsWithLocation } from "@/components/home/HomeSectionsWithLocation";
import { HomeQuickApply } from "@/components/home/HomeQuickApply";
import { HomeNoticeCommunity } from "@/components/home/HomeNoticeCommunity";
import { HomeLocation } from "@/components/home/HomeLocation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import Link from "next/link";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getTournamentsListRaw, getVenuesListRaw, type TournamentListRow } from "@/lib/db-tournaments";
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
  let venues: { id: string; name: string; slug: string }[] = [];

  if (isDatabaseConfigured()) {
    const [tList, vList] = await Promise.all([
      getTournamentsListRaw({ orderBy: "asc", take: 4 }),
      getVenuesListRaw(4),
    ]);
    tournaments = tList.length > 0 ? tList : (MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[]);
    venues = vList.length > 0 ? vList : MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug }));
  } else {
    tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
    venues = MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug }));
  }
  logServerTiming("db", dbStart);

  return (
    <>
      <HomeSectionsWithLocation
        initialVenues={venues}
        initialTournaments={tournaments}
        copy={copy}
      />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-wrap gap-4 justify-center text-sm">
        <Link href="/tournaments" className="text-site-primary hover:underline font-medium">
          대회 전체 보기 →
        </Link>
        <Link href="/venues" className="text-site-primary hover:underline font-medium">
          당구장 전체 보기 →
        </Link>
      </div>
      <HomeQuickApply copy={copy} />
      <HomeNoticeCommunity copy={copy} />
      <HomeLocation copy={copy} />
      <SiteFooter
        footer={siteSettings.footer}
        defaultTagline={copy["site.footer.tagline"] ?? undefined}
      />
    </>
  );
}
