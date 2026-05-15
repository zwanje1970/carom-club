import {
  listTournamentSnapshotsForMainSite,
  getMainSlideAdSettingsForSite,
} from "../../lib/surface-read";
import {
  listTournamentSnapshotsForMainSite as loadMainTournamentSnapshotsDirect,
} from "../../lib/server/platform-backing-store";
import type { MainSiteSlideAd } from "../../lib/site/main-slide-stream";
import { mergeTournamentAndAdSlideDeckItems, normalizeMainSlideAdConfig } from "../../lib/site/main-slide-stream";
import { slideDeckItemsToScrollCards } from "../../lib/site/slide-deck-items-to-scroll-cards";
import { headers } from "next/headers";
import { isCaromClubMobileAppShell } from "../../lib/is-carom-club-mobile-app-shell";
import CaromAppExitControl from "./components/CaromAppExitControl";
import SiteShellFrame from "./components/SiteShellFrame";
import SiteMainLogo from "./components/SiteMainLogo";
import { MainSiteSlideSection } from "./main-site-slide-section";
import type { SlideDeckItem } from "./tournament-snapshot-card-view";
import type { PublishedCardSnapshot } from "../../lib/server/platform-backing-store";
import { isMainSiteLoadDiagEnabled } from "../../lib/site/main-site-load-diag";

/** `/site` 표시만 제외 — 테스트용 메인 슬라이드 광고 제목만 숨김 */
function isMainSitePosterTestSlideItem(item: SlideDeckItem): boolean {
  const t = (item.title ?? "").trim();
  if (!/\[TEST\]/i.test(t)) return false;
  return /포스터\s*광고판\s*확인\s*(?:[1-5]|[１-５])\s*$/i.test(t);
}

async function loadMainSlideSnapshots(): Promise<PublishedCardSnapshot[]> {
  try {
    if (process.env.NODE_ENV === "development") {
      const rows = await loadMainTournamentSnapshotsDirect();
      return Array.isArray(rows) ? rows : [];
    }
    const rows = await listTournamentSnapshotsForMainSite();
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error("[site home] main slide snapshots", e);
    try {
      const rows = await loadMainTournamentSnapshotsDirect();
      return Array.isArray(rows) ? rows : [];
    } catch (e2) {
      console.error("[site home] main slide snapshots (direct fallback)", e2);
      return [];
    }
  }
}

function snapshotToTournamentSlideDeckItem(snapshot: PublishedCardSnapshot): SlideDeckItem {
  const pub320 =
    typeof snapshot.publishedCardImage320Url === "string" ? snapshot.publishedCardImage320Url.trim() : "";
  const pub480 =
    typeof snapshot.publishedCardImage480Url === "string" ? snapshot.publishedCardImage480Url.trim() : "";
  const pub640 = typeof snapshot.publishedCardImageUrl === "string" ? snapshot.publishedCardImageUrl.trim() : "";
  return {
    type: "tournament",
    linkType: "internal",
    snapshotId: snapshot.snapshotId,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    targetDetailUrl: snapshot.targetDetailUrl,
    ...(pub640 ? { publishedCardImageUrl: pub640 } : {}),
    ...(pub320 ? { publishedCardImage320Url: pub320 } : {}),
    ...(pub480 ? { publishedCardImage480Url: pub480 } : {}),
  };
}

function collectHeroImagePreloadUrls(scrollItems: { imageUrl: string | null }[], limit = 2): string[] {
  const out: string[] = [];
  for (const item of scrollItems) {
    const url = item.imageUrl?.trim() ?? "";
    if (!url || out.includes(url)) continue;
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

export default async function SiteOperationalHome() {
  const headerList = await headers();
  const appShell = isCaromClubMobileAppShell(headerList);
  const publicMobileSiteChrome = false;

  const [mainSlideSnapshots, adSettings] = await Promise.all([
    loadMainSlideSnapshots(),
    getMainSlideAdSettingsForSite().catch(() => ({
      config: normalizeMainSlideAdConfig(undefined),
      activeAds: [] as MainSiteSlideAd[],
    })),
  ]);

  const tournamentDeckItems = mainSlideSnapshots.map(snapshotToTournamentSlideDeckItem);
  const tournamentBaseForSlide = tournamentDeckItems.filter((item) => !isMainSitePosterTestSlideItem(item));
  const initialSlideDeckItems = mergeTournamentAndAdSlideDeckItems(
    tournamentBaseForSlide,
    adSettings.activeAds,
    adSettings.config,
  );
  const heroPreloadUrls = collectHeroImagePreloadUrls(slideDeckItemsToScrollCards(tournamentBaseForSlide));

  const scrollForReturnDiag = slideDeckItemsToScrollCards(initialSlideDeckItems);
  const firstScrollForReturnDiag = scrollForReturnDiag[0];
  console.info("[main-card-return-diag]", {
    phase: "server-operational-home",
    snapshotCount: mainSlideSnapshots.length,
    tournamentDeckItemsLen: tournamentDeckItems.length,
    initialSlideDeckItemsLen: initialSlideDeckItems.length,
    scrollCardsLen: scrollForReturnDiag.length,
    placeholderCards: scrollForReturnDiag.filter((c) => c.slideDeckPngPlaceholder).length,
    firstCardHasImageUrl: Boolean(firstScrollForReturnDiag?.imageUrl?.trim()),
    firstCardId: firstScrollForReturnDiag?.id ?? null,
  });

  if (isMainSiteLoadDiagEnabled()) {
    const scrollForDiag = slideDeckItemsToScrollCards(initialSlideDeckItems);
    const firstImageUrl = scrollForDiag[0]?.imageUrl?.trim() ?? "";
    console.info("[site-main-load-diag:server]", "main card data ready", {
      ts: Date.now(),
      snapshotCount: mainSlideSnapshots.length,
      scrollItemCount: scrollForDiag.length,
      firstCardImageUrlPresent: firstImageUrl.length > 0,
      ...(firstImageUrl ? { firstCardImageUrl: firstImageUrl } : {}),
      heroPreloadCount: heroPreloadUrls.length,
    });
  }

  const homeBrandTitle = <span className="site-home-main-mobile-dock-brand-placeholder" aria-hidden="true" />;

  return (
    <SiteShellFrame
      shellVariant="home"
      mainId="main-layout"
      brandTitle={homeBrandTitle}
      prependMain={appShell ? <CaromAppExitControl /> : null}
    >
      {heroPreloadUrls.map((url) => (
        <link key={url} rel="preload" as="image" href={url} fetchPriority="high" />
      ))}
      <section id="main-content-group" className="site-home-dark-main site-home-dark-main--stack">
        <div className="site-home-main-content-box">
          <section className="v3-stack site-home-slide-stack site-home-slide-stack--flush" style={{ gap: 0 }}>
            <MainSiteSlideSection
              initialSlideDeckItems={initialSlideDeckItems}
              tournamentDeckItems={tournamentDeckItems}
              defaultSlideSpeedLevel={adSettings.config.cardMoveDurationSec}
              publicMobileSiteChrome={publicMobileSiteChrome}
              logo={<SiteMainLogo />}
            />
          </section>
        </div>
      </section>
    </SiteShellFrame>
  );
}
