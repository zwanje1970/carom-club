"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SlideDeckItem } from "./tournament-snapshot-card-view";
import { MainSiteScrollCards, type MainSiteScrollCardItem } from "./main-site-scroll-cards";
import { MainSiteDeferredNotice } from "./main-site-deferred-notice";
import {
  DEFAULT_MAIN_SLIDE_AD_CONFIG,
  mergeTournamentAndAdSlideDeckItems,
  type MainSiteSlideAd,
  type MainSlideAdConfig,
} from "../../lib/site/main-slide-stream";
import { slideDeckItemsToScrollCards } from "../../lib/site/slide-deck-items-to-scroll-cards";

const MAIN_SITE_ADS_FETCH_DELAY_MS = 7_500;

type MainSiteSlideSectionProps = {
  initialScrollItems: MainSiteScrollCardItem[];
  tournamentDeckItems: SlideDeckItem[];
  defaultSlideSpeedLevel?: number;
  publicMobileSiteChrome?: boolean;
  logo: ReactNode;
};

function isMainSitePosterTestSlideItem(item: SlideDeckItem): boolean {
  const t = (item.title ?? "").trim();
  if (!/\[TEST\]/i.test(t)) return false;
  return /포스터\s*광고판\s*확인\s*(?:[1-5]|[１-５])\s*$/i.test(t);
}

export function MainSiteSlideSection({
  initialScrollItems,
  tournamentDeckItems,
  defaultSlideSpeedLevel = DEFAULT_MAIN_SLIDE_AD_CONFIG.cardMoveDurationSec,
  publicMobileSiteChrome = false,
  logo,
}: MainSiteSlideSectionProps) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [scrollItems, setScrollItems] = useState(initialScrollItems);
  const [slideSpeedLevel, setSlideSpeedLevel] = useState(defaultSlideSpeedLevel);

  const tournamentBase = useMemo(
    () => tournamentDeckItems.filter((item) => !isMainSitePosterTestSlideItem(item)),
    [tournamentDeckItems],
  );

  useEffect(() => {
    setScrollItems(initialScrollItems);
  }, [initialScrollItems]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/site/main-slide-deck-ads", { cache: "no-store" });
          if (!res.ok) return;
          const json = (await res.json()) as {
            config?: MainSlideAdConfig;
            activeAds?: MainSiteSlideAd[];
          };
          if (cancelled) return;
          const config = json.config ?? DEFAULT_MAIN_SLIDE_AD_CONFIG;
          const activeAds = Array.isArray(json.activeAds) ? json.activeAds : [];
          setSlideSpeedLevel(config.cardMoveDurationSec);
          const merged = mergeTournamentAndAdSlideDeckItems(tournamentBase, activeAds, config);
          setScrollItems(slideDeckItemsToScrollCards(merged));
        } catch {
          /* 메인 슬라이드와 분리 — 실패 시 대회 카드만 유지 */
        }
      })();
    }, MAIN_SITE_ADS_FETCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tournamentBase]);

  return (
    <div
      className={[
        "site-home-main-slide-png-host",
        noticeVisible ? "site-home-main-slide-png-host--with-site-notice" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="site-home-main-slide-logo-overlay">{logo}</div>
      <MainSiteDeferredNotice onVisibleChange={setNoticeVisible} />
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
          <MainSiteScrollCards items={scrollItems} slideCardMoveSpeedLevel={slideSpeedLevel} />
        </section>
      </div>
    </div>
  );
}
