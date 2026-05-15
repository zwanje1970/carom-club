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

function logMainCardReturnDiag(payload: Record<string, unknown>) {
  console.info("[main-card-return-diag]", payload);
}

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

function slideDeckPublishedScrollImgPresent(item: SlideDeckItem): boolean {
  const u =
    (item.publishedCardImage480Url ?? "").trim() ||
    (item.publishedCardImage320Url ?? "").trim() ||
    (item.publishedCardImageUrl ?? "").trim();
  return Boolean(u);
}

function slideDeckAdImage320Present(item: SlideDeckItem): boolean {
  return Boolean((item.image320Url ?? "").trim());
}

/**
 * RSC가 다시 내려올 때(홈 복귀 등) 클라이언트 덱에 이미 채워진 이미지·광고 URL이
 * 초기 props보다 나으면 같은 슬롯 인덱스에서 유지한다. 길이·순서는 incoming 기준.
 */
function mergeInitialSlideDeckPreferringRicherVisual(
  prevDeck: SlideDeckItem[],
  incoming: SlideDeckItem[],
): SlideDeckItem[] {
  if (prevDeck.length !== incoming.length) return incoming;
  const out: SlideDeckItem[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const inc = incoming[i]!;
    const prev = prevDeck[i]!;
    if (inc.type === "ad" && prev.type === "ad") {
      const sidIn = (inc.mainSlideScrollStableId ?? "").trim();
      const sidPr = (prev.mainSlideScrollStableId ?? "").trim();
      if (sidIn && sidPr === sidIn && slideDeckAdImage320Present(prev) && !slideDeckAdImage320Present(inc)) {
        out.push({ ...prev, mainSlideScrollStableId: sidIn });
        continue;
      }
    }
    if (inc.type !== "ad" && prev.type !== "ad" && inc.snapshotId === prev.snapshotId) {
      if (slideDeckPublishedScrollImgPresent(prev) && !slideDeckPublishedScrollImgPresent(inc)) {
        out.push({
          ...inc,
          ...(prev.publishedCardImageUrl?.trim() ? { publishedCardImageUrl: prev.publishedCardImageUrl } : {}),
          ...(prev.publishedCardImage320Url?.trim() ? { publishedCardImage320Url: prev.publishedCardImage320Url } : {}),
          ...(prev.publishedCardImage480Url?.trim() ? { publishedCardImage480Url: prev.publishedCardImage480Url } : {}),
        });
        continue;
      }
    }
    out.push(inc);
  }
  return out;
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
    logMainCardReturnDiag({
      phase: "slide-section-mount",
      path: typeof window !== "undefined" ? window.location.pathname : "",
    });
    return () => {
      logMainCardReturnDiag({
        phase: "slide-section-unmount",
        path: typeof window !== "undefined" ? window.location.pathname : "",
      });
    };
  }, []);

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const cards = slideDeckItemsToScrollCards(deckItems);
    const placeholderCards = cards.filter((c) => c.slideDeckPngPlaceholder).length;
    const withoutImageUrl = cards.filter((c) => !c.imageUrl?.trim()).length;
    logMainCardReturnDiag({
      phase: "slide-section-deck-snapshot",
      path,
      deckItemsLen: deckItems.length,
      scrollCardsLen: cards.length,
      placeholderCards,
      scrollCardsWithoutImageUrl: withoutImageUrl,
    });
  }, [deckItems]);

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const firstId = initialSlideDeckItems[0]?.snapshotId ?? null;
    logMainCardReturnDiag({
      phase: "slide-section-initial-props-sync",
      path,
      initialSlideDeckItemsLen: initialSlideDeckItems.length,
      firstDeckSnapshotId: firstId,
    });
    setDeckItems((prev) => mergeInitialSlideDeckPreferringRicherVisual(prev, initialSlideDeckItems));
  }, [initialSlideDeckItems]);

  useEffect(() => {
    setSlideSpeedLevel(defaultSlideSpeedLevel);
  }, [defaultSlideSpeedLevel]);

  useEffect(() => {
    let cancelled = false;
    logMainCardReturnDiag({
      phase: "ads-fetch-timer-scheduled",
      path: typeof window !== "undefined" ? window.location.pathname : "",
      delayMs: MAIN_SITE_ADS_FETCH_DELAY_MS,
      tournamentBaseLen: tournamentBase.length,
    });
    const timer = window.setTimeout(() => {
      void (async () => {
        logMainCardReturnDiag({
          phase: "ads-fetch-start",
          path: typeof window !== "undefined" ? window.location.pathname : "",
          deckItemsRefLen: deckItemsRef.current.length,
        });
        try {
          const res = await fetch("/api/site/main-slide-deck-ads", { cache: "no-store" });
          if (!res.ok) {
            logMainCardReturnDiag({
              phase: "ads-fetch-fail",
              path: typeof window !== "undefined" ? window.location.pathname : "",
              httpStatus: res.status,
            });
            return;
          }
          const json = (await res.json()) as {
            config?: unknown;
            activeAds?: MainSiteSlideAd[];
          };
          if (cancelled) {
            logMainCardReturnDiag({ phase: "ads-fetch-cancelled-after-json", path: typeof window !== "undefined" ? window.location.pathname : "" });
            return;
          }
          const config = normalizeMainSlideAdConfig(json.config ?? DEFAULT_MAIN_SLIDE_AD_CONFIG);
          const activeAds = Array.isArray(json.activeAds) ? json.activeAds : [];

          const merged = mergeTournamentAndAdSlideDeckItems(tournamentBase, activeAds, config);
          const aligned = alignMainSlideAdDeckStableScrollIds(deckItemsRef.current, merged);
          logMainCardReturnDiag({
            phase: "ads-preload-batch-start",
            path: typeof window !== "undefined" ? window.location.pathname : "",
            alignedLen: aligned.length,
            deckItemsRefLenBeforeAlign: deckItemsRef.current.length,
          });
          const preloadOkFlags = await Promise.all(
            aligned.map(async (deckItem) => {
              if (deckItem.type !== "ad") return true;
              const u = (deckItem.image320Url ?? "").trim();
              if (!u) return true;
              return preloadScrollCardImageOk(u);
            }),
          );
          const preloadAttempted = preloadOkFlags.filter((_, i) => {
            const d = aligned[i];
            return d?.type === "ad" && Boolean((d.image320Url ?? "").trim());
          }).length;
          const preloadFailed = preloadOkFlags.filter((ok, i) => {
            const d = aligned[i];
            return d?.type === "ad" && Boolean((d.image320Url ?? "").trim()) && !ok;
          }).length;
          const patched = aligned.map((deckItem, i) => {
            if (!preloadOkFlags[i] && deckItem.type === "ad") {
              const sid = (deckItem.mainSlideScrollStableId ?? "").trim();
              if (sid) return mainSlideAdPlaceholderSlideDeckItem(sid);
            }
            return deckItem;
          });
          if (cancelled) {
            logMainCardReturnDiag({ phase: "ads-fetch-cancelled-after-preload", path: typeof window !== "undefined" ? window.location.pathname : "" });
            return;
          }
          logMainCardReturnDiag({
            phase: "ads-fetch-success-set-deck",
            path: typeof window !== "undefined" ? window.location.pathname : "",
            mergedLen: merged.length,
            alignedLen: aligned.length,
            patchedLen: patched.length,
            activeAdsLen: activeAds.length,
            preloadAttempted,
            preloadFailed,
          });
          setSlideSpeedLevel(config.cardMoveDurationSec);
          setDeckItems(patched);
        } catch (err) {
          logMainCardReturnDiag({
            phase: "ads-fetch-throw",
            path: typeof window !== "undefined" ? window.location.pathname : "",
            err: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }, MAIN_SITE_ADS_FETCH_DELAY_MS);
    return () => {
      logMainCardReturnDiag({
        phase: "ads-fetch-timer-cancelled",
        path: typeof window !== "undefined" ? window.location.pathname : "",
      });
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
