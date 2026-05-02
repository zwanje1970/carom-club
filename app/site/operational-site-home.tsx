import {
  getMainSlideAdSettingsForSite,
  getSiteNotice,
  listTournamentSnapshotsForMainSite,
} from "../../lib/surface-read";
import {
  getMainSlideAdSettingsForSite as loadMainSlideAdSettingsDirect,
  getSiteNotice as loadSiteNoticeDirect,
  listTournamentSnapshotsForMainSite as loadMainTournamentSnapshotsDirect,
} from "../../lib/server/platform-backing-store";
import {
  mergeTournamentAndAdSlideDeckItems,
  normalizeMainSlideAdConfig,
  type MainSiteSlideAd,
} from "../../lib/site/main-slide-stream";
import SiteShellFrame from "./components/SiteShellFrame";
import SiteMainLogo from "./components/SiteMainLogo";
import { MainSiteScrollCards, type MainSiteScrollCardItem } from "./main-site-scroll-cards";
import type { SlideDeckItem } from "./tournament-snapshot-card-view";

/** `/site` 표시만 제외 — 병합·저장 API는 그대로 두고 테스트용 메인 슬라이드 광고 제목만 숨김 */
function isMainSitePosterTestSlideItem(item: SlideDeckItem): boolean {
  const t = (item.title ?? "").trim();
  if (!/\[TEST\]/i.test(t)) return false;
  return /포스터\s*광고판\s*확인\s*(?:[1-5]|[１-５])\s*$/i.test(t);
}

const emptySiteNotice = (): { enabled: false; text: string } => ({ enabled: false, text: "" });

const defaultMainSlideAdSettings = () => ({
  config: normalizeMainSlideAdConfig(undefined),
  activeAds: [] as MainSiteSlideAd[],
});

async function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<T | null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

async function safeListMainSlideSnapshots() {
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

async function safeGetSiteNoticeForHome() {
  try {
    if (process.env.NODE_ENV === "development") {
      return await loadSiteNoticeDirect();
    }
    return await getSiteNotice();
  } catch (e) {
    console.error("[site home] site notice", e);
    try {
      return await loadSiteNoticeDirect();
    } catch (e2) {
      console.error("[site home] site notice (direct fallback)", e2);
      return emptySiteNotice();
    }
  }
}

async function safeGetMainSlideAdSettingsForHome() {
  try {
    if (process.env.NODE_ENV === "development") {
      return await loadMainSlideAdSettingsDirect();
    }
    return await getMainSlideAdSettingsForSite();
  } catch (e) {
    console.error("[site home] main slide ad settings", e);
    try {
      return await loadMainSlideAdSettingsDirect();
    } catch (e2) {
      console.error("[site home] main slide ad settings (direct fallback)", e2);
      return { config: normalizeMainSlideAdConfig(undefined), activeAds: [] };
    }
  }
}

function slideDeckItemsToScrollCards(items: SlideDeckItem[]): MainSiteScrollCardItem[] {
  return items.map((item) => {
    const href = (item.targetDetailUrl ?? "").trim() || "/site/tournaments";
    const external = item.linkType === "external" || /^https?:\/\//i.test(href);

    try {
      if (item.type !== "ad") {
        const published640T = (item.publishedCardImageUrl ?? "").trim();
        const published320T = (item.publishedCardImage320Url ?? "").trim();
        const publishedScrollBgT = published640T || published320T;
        console.log("MAIN_CARD_IMAGE_DEBUG", {
          title: item.title,
          publishedCardImageUrl: item.publishedCardImageUrl,
          publishedCardImage320Url: item.publishedCardImage320Url,
          selectedImageUrl: publishedScrollBgT,
        });
        /** 메인만: 게시 PNG URL이 있으면 플랫 이미지 카드(오버레이 없음). 없으면 HTML 카드 */
        if (publishedScrollBgT) {
          return {
            id: item.snapshotId,
            href,
            title: item.title,
            imageUrl: publishedScrollBgT,
            faceCssBackground: null,
            external,
            faceIsFullPublishedSnapshot: true,
            suppressPublishedScrollOverlay: true,
          };
        }
        return {
          id: item.snapshotId,
          href,
          title: item.title,
          imageUrl: null,
          faceCssBackground: null,
          external,
          slideDeckItem: item,
        };
      }

      const published640 = (item.publishedCardImageUrl ?? "").trim();
      const published320 = (item.publishedCardImage320Url ?? "").trim();
      /** 메인 슬라이드: 640 우선(320은 목록 등 다른 경로 유지). 둘 다 없으면 게시 면 미사용 */
      const publishedScrollBg = published640 || published320;
      if (publishedScrollBg) {
        const isAd = item.type === "ad";
        const metaTint =
          (item.cardFooterDateTextColor ?? "").trim() ||
          (item.cardFooterPlaceTextColor ?? "").trim() ||
          (item.cardDescriptionTextColor ?? "").trim() ||
          null;
        return {
          id: item.snapshotId,
          href,
          title: item.title,
          imageUrl: publishedScrollBg,
          faceCssBackground: null,
          external,
          faceIsFullPublishedSnapshot: true,
          scrollFaceBadge: isAd ? "광고" : item.statusBadge?.trim() || null,
          scrollFaceSubtitle: (item.subtitle ?? "").trim() || null,
          scrollFaceExtraLine1: item.cardExtraLine1?.trim() || null,
          scrollFaceExtraLine2: item.cardExtraLine2?.trim() || null,
          scrollFaceExtraLine3: item.cardExtraLine3?.trim() || null,
          scrollFaceTitleColor: item.cardTitleTextColor?.trim() || null,
          scrollFaceMetaColor: metaTint,
          scrollFaceStrongTextShadow: Boolean(item.cardTextShadowEnabled),
        };
      }
      const useBgImage = item.backgroundType !== "theme" && Boolean(item.image320Url?.trim());
      const imageUrl = useBgImage ? item.image320Url!.trim() : null;
      const faceCssBackground =
        !imageUrl && item.mediaBackground?.trim() ? item.mediaBackground.trim() : !imageUrl ? "transparent" : null;
      return {
        id: item.snapshotId,
        href,
        title: item.title,
        imageUrl,
        faceCssBackground,
        external,
        ...(item.type === "ad" && imageUrl
          ? {
              faceMatchPublishedScrollMetrics: true as const,
              scrollFaceBadge: "광고" as const,
              scrollFaceSubtitle: (item.subtitle ?? "").trim() || null,
              scrollFaceExtraLine1: item.cardExtraLine1?.trim() || null,
              scrollFaceExtraLine2: item.cardExtraLine2?.trim() || null,
              scrollFaceExtraLine3: item.cardExtraLine3?.trim() || null,
              scrollFaceTitleColor: item.cardTitleTextColor?.trim() || null,
              scrollFaceMetaColor:
                (item.cardFooterDateTextColor ?? "").trim() ||
                (item.cardFooterPlaceTextColor ?? "").trim() ||
                (item.cardDescriptionTextColor ?? "").trim() ||
                null,
              scrollFaceStrongTextShadow: Boolean(item.cardTextShadowEnabled),
            }
          : {}),
      };
    } catch {
      if (item.type !== "ad") {
        return {
          id: item.snapshotId,
          href,
          title: item.title,
          imageUrl: null,
          faceCssBackground: null,
          external,
          slideDeckItem: item,
        };
      }
      return {
        id: item.snapshotId,
        href,
        title: item.title,
        imageUrl: null,
        faceCssBackground: item.mediaBackground?.trim() ? item.mediaBackground.trim() : "transparent",
        external,
      };
    }
  });
}

export default async function SiteOperationalHome() {
  console.log("HOME: start");
  /** headers() 제거: 요청별 값으로 동적 렌더·재요청 루프 방지. 모바일 크롬 분기는 임시 비활성(false). */
  const publicMobileSiteChrome = false;

  console.log("HOME: before snapshots");
  const mainSlideSnapshots = (await withTimeout(safeListMainSlideSnapshots())) ?? [];
  console.log("HOME: after snapshots");

  console.log("HOME: before notice");
  const siteNotice = (await withTimeout(safeGetSiteNoticeForHome())) ?? emptySiteNotice();
  console.log("HOME: after notice");

  console.log("HOME: before ads");
  const mainSlideAdSettings = (await withTimeout(safeGetMainSlideAdSettingsForHome())) ?? defaultMainSlideAdSettings();
  console.log("HOME: after ads");

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
    ...(typeof snapshot.publishedCardImage320Url === "string" && snapshot.publishedCardImage320Url.trim()
      ? { publishedCardImage320Url: snapshot.publishedCardImage320Url.trim() }
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

  console.log("HOME: render ready");
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
