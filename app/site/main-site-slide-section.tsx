"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SlideDeckItem } from "./tournament-snapshot-card-view";
import { MainSiteScrollCards, type MainSiteScrollCardItem } from "./main-site-scroll-cards";
import { MainSiteDeferredNotice } from "./main-site-deferred-notice";
import {
  DEFAULT_MAIN_SLIDE_AD_CONFIG,
  alignMainSlideAdDeckStableScrollIds,
  mainSlideAdPlaceholderSlideDeckItem,
  mergeTournamentAndAdSlideDeckItems,
  normalizeMainSlideAdConfig,
  type MainSiteSlideAd,
} from "../../lib/site/main-slide-stream";
import { slideDeckItemsToScrollCards } from "../../lib/site/slide-deck-items-to-scroll-cards";

const MAIN_SITE_ADS_FETCH_DELAY_MS = 7_500;

type MainSiteSlideSectionProps = {
  /** SSR: 광고 슬롯 포함 전체 덱(placeholder·실광고 동일 규칙) */
  initialSlideDeckItems: SlideDeckItem[];
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

function preloadScrollCardImageOk(url: string): Promise<boolean> {
  const u = url.trim();
  if (!u) return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = u;
  });
}

export function MainSiteSlideSection({
  initialSlideDeckItems,
  tournamentDeckItems,
  defaultSlideSpeedLevel = DEFAULT_MAIN_SLIDE_AD_CONFIG.cardMoveDurationSec,
  publicMobileSiteChrome = false,
  logo,
}: MainSiteSlideSectionProps) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [deckItems, setDeckItems] = useState(initialSlideDeckItems);
  const [slideSpeedLevel, setSlideSpeedLevel] = useState(defaultSlideSpeedLevel);
  const deckItemsRef = useRef(deckItems);
  deckItemsRef.current = deckItems;

  const tournamentBase = useMemo(
    () => tournamentDeckItems.filter((item) => !isMainSitePosterTestSlideItem(item)),
    [tournamentDeckItems],
  );

  const scrollItems: MainSiteScrollCardItem[] = useMemo(
    () => slideDeckItemsToScrollCards(deckItems),
    [deckItems],
  );

  useEffect(() => {
    setDeckItems(initialSlideDeckItems);
  }, [initialSlideDeckItems]);

  useEffect(() => {
    setSlideSpeedLevel(defaultSlideSpeedLevel);
  }, [defaultSlideSpeedLevel]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/site/main-slide-deck-ads", { cache: "no-store" });
          if (!res.ok) return;
          const json = (await res.json()) as {
            config?: unknown;
            activeAds?: MainSiteSlideAd[];
          };
          if (cancelled) return;
          const config = normalizeMainSlideAdConfig(json.config ?? DEFAULT_MAIN_SLIDE_AD_CONFIG);
          const activeAds = Array.isArray(json.activeAds) ? json.activeAds : [];

          const merged = mergeTournamentAndAdSlideDeckItems(tournamentBase, activeAds, config);
          const aligned = alignMainSlideAdDeckStableScrollIds(deckItemsRef.current, merged);
          const preloadOkFlags = await Promise.all(
            aligned.map(async (deckItem) => {
              if (deckItem.type !== "ad") return true;
              const u = (deckItem.image320Url ?? "").trim();
              if (!u) return true;
              return preloadScrollCardImageOk(u);
            }),
          );
          const patched = aligned.map((deckItem, i) => {
            if (!preloadOkFlags[i] && deckItem.type === "ad") {
              const sid = (deckItem.mainSlideScrollStableId ?? "").trim();
              if (sid) return mainSlideAdPlaceholderSlideDeckItem(sid);
            }
            return deckItem;
          });
          if (cancelled) return;
          setSlideSpeedLevel(config.cardMoveDurationSec);
          setDeckItems(patched);
        } catch {
          /* 메인 슬라이드와 분리 — 실패 시 기존 덱 유지 */
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
