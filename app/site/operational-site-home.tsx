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
import { parsePublishedCardOverlaySnapshotForStorage } from "../../lib/site/tournament-card-overlay-snapshot";
import { headers } from "next/headers";
import { isCaromClubMobileAppShell } from "../../lib/is-carom-club-mobile-app-shell";
import CaromAppExitControl from "./components/CaromAppExitControl";
import SiteShellFrame from "./components/SiteShellFrame";
import SiteMainLogo from "./components/SiteMainLogo";
import { MainSiteScrollCards, type MainSiteScrollCardItem } from "./main-site-scroll-cards";
import type { SlideDeckItem } from "./tournament-snapshot-card-view";
import type { MainSiteTournamentCardTextOverlayPayload } from "./main-site-tournament-card-text-overlay";

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
  return items.map((item, index) => {
    const href = (item.targetDetailUrl ?? "").trim() || "/site/tournaments";
    const external = item.linkType === "external" || /^https?:\/\//i.test(href);
    /** 순환 병합 시 동일 snapshotId가 반복될 수 있어 리스트 인덱스로 키를 유일화 */
    const rowId = `${item.snapshotId}__m${index}`;

    try {
      if (item.type !== "ad") {
        /** 메인 대회 면: 게시 PNG 만 — 대회·광고와 동일 슬라이드 덱 행(slideDeckPng*). */
        const published640 = (item.publishedCardImageUrl ?? "").trim();
        const published320 = (item.publishedCardImage320Url ?? "").trim();
        const scrollImg = published320 || published640;
        const needsHtmlOverlay = item.publishedCardImageBackgroundOnly === true && Boolean(scrollImg);
        const tournamentCardOverlaySnapshot =
          needsHtmlOverlay && item.overlaySnapshot ? item.overlaySnapshot : undefined;
        const tournamentCardTextOverlay: MainSiteTournamentCardTextOverlayPayload | undefined =
          needsHtmlOverlay && !tournamentCardOverlaySnapshot
            ? {
                cardTemplate: item.cardTemplate ?? "A",
                surfaceLayout: item.cardSurfaceLayout === "full" ? "full" : "split",
                statusBadge: item.statusBadge ?? null,
                title: item.title,
                subtitle: item.subtitle,
                cardExtraLine1: item.cardExtraLine1 ?? null,
                cardExtraLine2: item.cardExtraLine2 ?? null,
                cardExtraLine3: item.cardExtraLine3 ?? null,
                cardLeadTextColor: item.cardLeadTextColor ?? null,
                cardTitleTextColor: item.cardTitleTextColor ?? null,
                cardDescriptionTextColor: item.cardDescriptionTextColor ?? null,
                cardTextShadowEnabled: item.cardTextShadowEnabled === true,
                cardFooterDateTextColor: item.cardFooterDateTextColor ?? null,
                cardFooterPlaceTextColor: item.cardFooterPlaceTextColor ?? null,
              }
            : undefined;
        return {
          id: rowId,
          href,
          title: item.title,
          imageUrl: scrollImg || null,
          faceCssBackground: scrollImg ? null : "#0f172a",
          external,
          slideDeckPngFace: Boolean(scrollImg),
          slideDeckPngPlaceholder: !scrollImg,
          slideDeckPngAdMark: false,
          ...(tournamentCardOverlaySnapshot ? { tournamentCardOverlaySnapshot } : {}),
          ...(tournamentCardTextOverlay ? { tournamentCardTextOverlay } : {}),
        };
      }

      const published640 = (item.publishedCardImageUrl ?? "").trim();
      const published320 = (item.publishedCardImage320Url ?? "").trim();
      const publishedScrollBg = published320 || published640;
      if (publishedScrollBg) {
        return {
          id: rowId,
          href,
          title: item.title,
          imageUrl: publishedScrollBg,
          faceCssBackground: null,
          external,
          slideDeckPngFace: true,
          slideDeckPngPlaceholder: false,
          slideDeckPngAdMark: true,
        };
      }
      const useBgImage = item.backgroundType !== "theme" && Boolean(item.image320Url?.trim());
      const imageUrl = useBgImage ? item.image320Url!.trim() : null;
      const faceCssBackground =
        !imageUrl && item.mediaBackground?.trim() ? item.mediaBackground.trim() : !imageUrl ? "transparent" : null;
      return {
        id: rowId,
        href,
        title: item.title,
        imageUrl,
        faceCssBackground,
        external,
        slideDeckPngFace: Boolean(imageUrl),
        slideDeckPngPlaceholder: !imageUrl,
        slideDeckPngAdMark: true,
      };
    } catch {
      if (item.type !== "ad") {
        const published640 = (item.publishedCardImageUrl ?? "").trim();
        const published320 = (item.publishedCardImage320Url ?? "").trim();
        const scrollImg = published320 || published640;
        const needsHtmlOverlay = item.publishedCardImageBackgroundOnly === true && Boolean(scrollImg);
        const tournamentCardOverlaySnapshot =
          needsHtmlOverlay && item.overlaySnapshot ? item.overlaySnapshot : undefined;
        const tournamentCardTextOverlay: MainSiteTournamentCardTextOverlayPayload | undefined =
          needsHtmlOverlay && !tournamentCardOverlaySnapshot
            ? {
                cardTemplate: item.cardTemplate ?? "A",
                surfaceLayout: item.cardSurfaceLayout === "full" ? "full" : "split",
                statusBadge: item.statusBadge ?? null,
                title: item.title,
                subtitle: item.subtitle,
                cardExtraLine1: item.cardExtraLine1 ?? null,
                cardExtraLine2: item.cardExtraLine2 ?? null,
                cardExtraLine3: item.cardExtraLine3 ?? null,
                cardLeadTextColor: item.cardLeadTextColor ?? null,
                cardTitleTextColor: item.cardTitleTextColor ?? null,
                cardDescriptionTextColor: item.cardDescriptionTextColor ?? null,
                cardTextShadowEnabled: item.cardTextShadowEnabled === true,
                cardFooterDateTextColor: item.cardFooterDateTextColor ?? null,
                cardFooterPlaceTextColor: item.cardFooterPlaceTextColor ?? null,
              }
            : undefined;
        return {
          id: rowId,
          href,
          title: item.title,
          imageUrl: scrollImg || null,
          faceCssBackground: scrollImg ? null : "#0f172a",
          external,
          slideDeckPngFace: Boolean(scrollImg),
          slideDeckPngPlaceholder: !scrollImg,
          slideDeckPngAdMark: false,
          ...(tournamentCardOverlaySnapshot ? { tournamentCardOverlaySnapshot } : {}),
          ...(tournamentCardTextOverlay ? { tournamentCardTextOverlay } : {}),
        };
      }
      return {
        id: rowId,
        href,
        title: item.title,
        imageUrl: null,
        faceCssBackground: item.mediaBackground?.trim() ? item.mediaBackground.trim() : "transparent",
        external,
        slideDeckPngFace: false,
        slideDeckPngPlaceholder: true,
        slideDeckPngAdMark: true,
      };
    }
  });
}

export default async function SiteOperationalHome() {
  const headerList = await headers();
  const appShell = isCaromClubMobileAppShell(headerList);
  /** headers() 제거: 요청별 값으로 동적 렌더·재요청 루프 방지. 모바일 크롬 분기는 임시 비활성(false). */
  const publicMobileSiteChrome = false;

  const [mainSlideSnapshots, siteNotice, mainSlideAdSettings] = await Promise.all([
    withTimeout(safeListMainSlideSnapshots()).then((v) => v ?? []),
    withTimeout(safeGetSiteNoticeForHome()).then((v) => v ?? emptySiteNotice()),
    withTimeout(safeGetMainSlideAdSettingsForHome()).then(
      (v) => v ?? defaultMainSlideAdSettings(),
    ),
  ]);

  const tournamentSlideDeckItems: SlideDeckItem[] = mainSlideSnapshots.map((snapshot) => {
    const pub320 = typeof snapshot.publishedCardImage320Url === "string" ? snapshot.publishedCardImage320Url.trim() : "";
    const pub640 = typeof snapshot.publishedCardImageUrl === "string" ? snapshot.publishedCardImageUrl.trim() : "";
    const hasPublishedCardPng = Boolean(pub320 || pub640);
    /** 과거 배경-only PNG는 플래그 누락 시 overlay 유지. 서버 완성 PNG는 false가 compact에 저장되어 overlay 없음. */
    const publishedPngNeedsHtmlTextOverlay =
      snapshot.publishedCardImageBackgroundOnly === true ||
      (hasPublishedCardPng && snapshot.publishedCardImageBackgroundOnly !== false);
    const overlayParsed = parsePublishedCardOverlaySnapshotForStorage(snapshot.overlaySnapshot);
    return {
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
      ...(pub640 ? { publishedCardImageUrl: pub640 } : {}),
      ...(pub320 ? { publishedCardImage320Url: pub320 } : {}),
      ...(publishedPngNeedsHtmlTextOverlay ? { publishedCardImageBackgroundOnly: true as const } : {}),
      ...(overlayParsed ? { overlaySnapshot: overlayParsed } : {}),
    };
  });

  const liveSlideItems = mergeTournamentAndAdSlideDeckItems(
    tournamentSlideDeckItems,
    mainSlideAdSettings.activeAds,
    mainSlideAdSettings.config,
  );

  const scrollItems = slideDeckItemsToScrollCards(liveSlideItems.filter((item) => !isMainSitePosterTestSlideItem(item)));
  const showSiteNoticeBar = Boolean(siteNotice.enabled) && siteNotice.text.trim().length > 0;
  const homeBrandTitle = <span className="site-home-main-mobile-dock-brand-placeholder" aria-hidden="true" />;

  return (
    <SiteShellFrame
      shellVariant="home"
      mainId="main-layout"
      brandTitle={homeBrandTitle}
      prependMain={appShell ? <CaromAppExitControl /> : null}
    >
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
                    slideCardMoveSpeedLevel={mainSlideAdSettings.config.cardMoveDurationSec}
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
