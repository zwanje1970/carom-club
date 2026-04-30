import { headers } from "next/headers";
import {
  getMainSlideAdSettingsForSite,
  getSiteNotice,
  listTournamentSnapshotsForMainSite,
} from "../../lib/surface-read";
import { mergeTournamentAndAdSlideDeckItems } from "../../lib/site/main-slide-stream";
import SiteShellFrame from "./components/SiteShellFrame";
import { isPublicSiteMobileView } from "./components/SiteChromeHeader";
import SiteMainLogo from "./components/SiteMainLogo";
import { MainSiteScrollCards, type MainSiteScrollCardItem } from "./main-site-scroll-cards";
import type { SlideDeckItem } from "./tournament-snapshot-card-view";

/** `/site` 표시만 제외 — 병합·저장 API는 그대로 두고 테스트용 메인 슬라이드 광고 제목만 숨김 */
function isMainSitePosterTestSlideItem(item: SlideDeckItem): boolean {
  const t = (item.title ?? "").trim();
  if (!/\[TEST\]/i.test(t)) return false;
  return /포스터\s*광고판\s*확인\s*(?:[1-5]|[１-５])\s*$/i.test(t);
}

function slideDeckItemsToScrollCards(items: SlideDeckItem[]): MainSiteScrollCardItem[] {
  return items.map((item) => {
    const href = (item.targetDetailUrl ?? "").trim() || "/site/tournaments";
    const external = item.linkType === "external" || /^https?:\/\//i.test(href);
    const published = (item.publishedCardImageUrl ?? "").trim();
    if (published) {
      return {
        id: item.snapshotId,
        href,
        title: item.title,
        imageUrl: published,
        faceCssBackground: null,
        external,
        faceIsFullPublishedSnapshot: true,
      };
    }
    const useBgImage = item.backgroundType !== "theme" && Boolean(item.image320Url?.trim());
    const imageUrl = useBgImage ? item.image320Url!.trim() : null;
    const faceCssBackground =
      !imageUrl && item.mediaBackground?.trim()
        ? item.mediaBackground.trim()
        : !imageUrl
          ? "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)"
          : null;
    return {
      id: item.snapshotId,
      href,
      title: item.title,
      imageUrl,
      faceCssBackground,
      external,
    };
  });
}

export default async function SiteOperationalHome() {
  const headerStore = await headers();
  const publicMobileSiteChrome = isPublicSiteMobileView(headerStore);

  const [mainSlideSnapshots, siteNotice, mainSlideAdSettings] = await Promise.all([
    listTournamentSnapshotsForMainSite(),
    getSiteNotice().catch(() => ({ enabled: false as const, text: "" })),
    getMainSlideAdSettingsForSite(),
  ]);

  const tournamentSlideDeckItems: SlideDeckItem[] = mainSlideSnapshots.map((snapshot) => ({
    type: "tournament" as const,
    linkType: "internal" as const,
    snapshotId: snapshot.snapshotId,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    targetDetailUrl: snapshot.targetDetailUrl,
    image320Url: snapshot.image320Url,
    statusBadge: snapshot.statusBadge,
    cardExtraLine1: snapshot.cardExtraLine1,
    cardExtraLine2: snapshot.cardExtraLine2,
    cardExtraLine3: snapshot.cardExtraLine3,
    cardTemplate: snapshot.tournamentCardTemplate ?? "A",
    backgroundType: snapshot.tournamentBackgroundType ?? (snapshot.image320Url?.trim() ? "image" : "theme"),
    themeType: snapshot.tournamentTheme ?? "dark",
    ...(typeof snapshot.tournamentMediaBackground === "string"
      ? { mediaBackground: snapshot.tournamentMediaBackground }
      : {}),
    ...(typeof snapshot.tournamentImageOverlayBlend === "boolean"
      ? { imageOverlayBlend: snapshot.tournamentImageOverlayBlend }
      : {}),
    ...(typeof snapshot.tournamentImageOverlayOpacity === "number"
      ? { imageOverlayOpacity: snapshot.tournamentImageOverlayOpacity }
      : {}),
    ...(typeof snapshot.cardLeadTextColor === "string" && snapshot.cardLeadTextColor.trim()
      ? { cardLeadTextColor: snapshot.cardLeadTextColor.trim() }
      : {}),
    ...(typeof snapshot.cardTitleTextColor === "string" && snapshot.cardTitleTextColor.trim()
      ? { cardTitleTextColor: snapshot.cardTitleTextColor.trim() }
      : {}),
    ...(typeof snapshot.cardDescriptionTextColor === "string" && snapshot.cardDescriptionTextColor.trim()
      ? { cardDescriptionTextColor: snapshot.cardDescriptionTextColor.trim() }
      : {}),
    ...(snapshot.tournamentCardTextShadowEnabled === true ? { cardTextShadowEnabled: true } : {}),
    ...(snapshot.tournamentCardSurfaceLayout === "full" ? { cardSurfaceLayout: "full" as const } : {}),
    ...(typeof snapshot.cardFooterDateTextColor === "string" && snapshot.cardFooterDateTextColor.trim()
      ? { cardFooterDateTextColor: snapshot.cardFooterDateTextColor.trim() }
      : {}),
    ...(typeof snapshot.cardFooterPlaceTextColor === "string" && snapshot.cardFooterPlaceTextColor.trim()
      ? { cardFooterPlaceTextColor: snapshot.cardFooterPlaceTextColor.trim() }
      : {}),
    ...(typeof snapshot.publishedCardImageUrl === "string" && snapshot.publishedCardImageUrl.trim()
      ? { publishedCardImageUrl: snapshot.publishedCardImageUrl.trim() }
      : {}),
  }));

  const liveSlideItems = mergeTournamentAndAdSlideDeckItems(
    tournamentSlideDeckItems,
    mainSlideAdSettings.activeAds,
    mainSlideAdSettings.config,
  );

  const scrollItems = slideDeckItemsToScrollCards(liveSlideItems.filter((item) => !isMainSitePosterTestSlideItem(item)));
  const showSiteNoticeBar = Boolean(siteNotice.enabled) && siteNotice.text.trim().length > 0;
  const homeBrandTitle = <span className="site-home-main-mobile-dock-brand-placeholder" aria-hidden="true" />;

  return (
    <SiteShellFrame shellVariant="home" mainId="main-layout" brandTitle={homeBrandTitle}>
      <section id="main-content-group" className="site-home-dark-main site-home-dark-main--stack">
        <div className="site-home-main-content-box">
          <section className="v3-stack site-home-slide-stack site-home-slide-stack--flush" style={{ gap: 0 }}>
            <div
              className={[
                "site-home-main-slide-png-host",
                showSiteNoticeBar ? "site-home-main-slide-png-host--with-site-notice" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="site-home-main-slide-logo-overlay">
                <SiteMainLogo />
              </div>
              <div
                className="site-home-main-notice-strip"
                aria-live={showSiteNoticeBar ? "polite" : undefined}
                role={showSiteNoticeBar ? "status" : undefined}
                aria-hidden={showSiteNoticeBar ? undefined : "true"}
              >
                <div className="site-home-main-notice-strip__inner">
                  {showSiteNoticeBar ? (
                    <span className="site-home-main-notice-strip__text">{siteNotice.text.trim()}</span>
                  ) : null}
                </div>
              </div>
              <div
                className={
                  publicMobileSiteChrome
                    ? "site-home-main-slide-deck-stack site-home-main-slide-deck-stack--public-mobile"
                    : "site-home-main-slide-deck-stack"
                }
              >
                <section
                  className="site-home-slide-anchor site-home-slide-anchor--marquee-scroll"
                  data-section-id="section-site-main-scroll"
                >
                  <MainSiteScrollCards
                    items={scrollItems}
                    slideCardMoveDurationSec={mainSlideAdSettings.config.cardMoveDurationSec}
                  />
                </section>
              </div>
            </div>
          </section>
        </div>
      </section>
    </SiteShellFrame>
  );
}
