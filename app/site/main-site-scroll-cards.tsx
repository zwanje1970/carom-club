"use client";

import Link from "next/link";
import type { KeyboardEvent, PointerEvent, Ref } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./main-sample/main-sample.module.css";
import siteStyles from "./main-site-scroll-cards.module.css";
import deckShellStyles from "./main-site-scroll-tournament-deck-shell.module.css";
import { isMainSiteLoadDiagEnabled, logMainSiteLoadDiag } from "../../lib/site/main-site-load-diag";

function logMainCardReturnDiag(payload: Record<string, unknown>) {
  console.info("[main-card-return-diag]", payload);
}

const SITE_SCROLL_CARD = "data-site-scroll-card";
const SITE_SCROLL_SHORTCUT = "data-site-scroll-shortcut";

/** 메인 이탈 후 복귀 시 세로 스크롤 위치 복원 — 새 세션·덱 변경 시 무시 */
const MAIN_SITE_SCROLL_STORAGE_KEY = "site-main-marquee-scroll-v1";
/** 카드 선택 후 무동작 시 자동 선택취소 */
const MAIN_SITE_CARD_AUTO_DESELECT_MS = 10_000;

type MainSiteScrollStoredV1 = {
  v: 1;
  idsKey: string;
  scrollTop: number;
};

type MainSiteScrollStoredV2 = {
  v: 2;
  idsKey: string;
  scrollTop: number;
  /** 덱 구성 변경 시에도 대략 같은 진행 구간을 복원하기 위한 비율(0~1) */
  progressRatio: number;
};

function mainScrollIdsKey(items: MainSiteScrollCardItem[]): string {
  return items.map((i) => i.id).join("\u001f");
}

export type MainSiteScrollCardItem = {
  id: string;
  href: string;
  title: string;
  imageUrl: string | null;
  /** 이미지 없을 때 카드 면 배경(CSS `background` 값) */
  faceCssBackground: string | null;
  external: boolean;
  /** 슬라이드 덱 PNG 행: 이미지 면(대회·광고 동일 래퍼) */
  slideDeckPngFace?: boolean;
  /** PNG 없음 — 플레이스홀더 면만 */
  slideDeckPngPlaceholder?: boolean;
  /** 광고만 우측 상단 AD 표시(포인터 비참여) */
  slideDeckPngAdMark?: boolean;
};

type CardRowProps = {
  rowKey: string;
  item: MainSiteScrollCardItem;
  selected: boolean;
  onCardPointerDown: (itemId: string) => void;
  /** CTA 탭 시 자동 선택취소 타이머 제거(상세 진입) */
  onShortcutActivate?: () => void;
  /** 문서 순서상 첫 번째 면 이미지(LCP 후보) — 링크 preload 없이 img 우선순위만 부여 */
  lcpHeroImage?: boolean;
  /** 초기 뷰포트 근처 카드: lazy 완화 */
  prioritizeNearViewportImage?: boolean;
  onLcpHeroImageLoad?: () => void;
  onLcpHeroImageError?: () => void;
};

function cardSlotClassNames(base: string, selected: boolean, selectedMod?: string): string {
  return [base, selected && selectedMod, selected && "card-selected"].filter(Boolean).join(" ");
}

const MainSiteCardRow = memo(function MainSiteCardRow({
  rowKey: _rowKey,
  item,
  selected,
  onCardPointerDown,
  onShortcutActivate,
  lcpHeroImage = false,
  prioritizeNearViewportImage = false,
  onLcpHeroImageLoad,
  onLcpHeroImageError,
}: CardRowProps) {
  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(`[${SITE_SCROLL_SHORTCUT}]`)) return;
      if (t?.closest("a[href]")) return;
      onCardPointerDown(item.id);
    },
    [item.id, onCardPointerDown],
  );

  const deckImgUrl = item.imageUrl?.trim() ?? "";
  /** PNG 면: 표시 가능한 이미지 URL이 있으면 PNG 면(플래그와 어긋나도 URL 우선 — 홈 복귀 후 플래그 잔류 방지) */
  const showPngDeck = Boolean(deckImgUrl);

  const slotShellProps = {
    className: cardSlotClassNames(styles.sampleMainCardSlot, selected, styles.sampleMainCardSlotSelected),
    ...{ [SITE_SCROLL_CARD]: "" },
    style: { touchAction: "pan-y" as const },
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": selected,
    "aria-label": `${item.title}${selected ? ", 선택됨" : ""}`,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      onCardPointerDown(item.id);
    },
  };

  const shortcutSelected =
    selected &&
    (item.external ? (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.sampleMainCardShortcut}
        {...{ [SITE_SCROLL_SHORTCUT]: "" }}
        tabIndex={0}
        onPointerDown={(e) => {
          e.stopPropagation();
          onShortcutActivate?.();
        }}
        onClick={() => onShortcutActivate?.()}
      >
        자세히 보기 ▶
      </a>
    ) : (
      <Link
        href={item.href}
        prefetch={false}
        className={styles.sampleMainCardShortcut}
        {...{ [SITE_SCROLL_SHORTCUT]: "" }}
        tabIndex={0}
        onPointerDown={(e) => {
          e.stopPropagation();
          onShortcutActivate?.();
        }}
        onClick={() => onShortcutActivate?.()}
      >
        자세히 보기 ▶
      </Link>
    ));

  if (showPngDeck) {
    return (
      <div {...slotShellProps}>
        <div
          className={`${styles.sampleMainCardFace} ${styles.sampleMainCardFaceTournamentDeck} ${selected ? styles.sampleMainCardFaceSelected : ""}`}
        >
          <div className={siteStyles.cardRowInteractionWrap} onPointerDown={onPointerDown}>
            <div className={styles.sampleMainCardDeckFit}>
              <div className={styles.sampleMainCardDeckFitInner}>
                <div className={siteStyles.mainScrollDeckCardShell}>
                  <div
                    className={`${deckShellStyles.mainScrollDeckCardOuter} ${deckShellStyles.mainScrollDeckCardOuterFlex}${selected ? ` ${deckShellStyles.mainScrollDeckCardOuterSelected}` : ""}`}
                  >
                    <div
                      className={`${deckShellStyles.mainScrollDeckCardInner} ${deckShellStyles.mainScrollDeckCardInnerFlex}`}
                    >
                      <div className={styles.sampleMainCardPublishedInner}>
                        <img
                          src={deckImgUrl}
                          alt=""
                          className={styles.sampleMainCardPosterPublishedSnapshot}
                          decoding={prioritizeNearViewportImage ? "sync" : "async"}
                          loading={prioritizeNearViewportImage ? "eager" : "lazy"}
                          {...(lcpHeroImage
                            ? { fetchPriority: "high" as const }
                            : prioritizeNearViewportImage
                              ? { fetchPriority: "auto" as const }
                              : {})}
                          {...(lcpHeroImage
                            ? {
                                onLoad: () => onLcpHeroImageLoad?.(),
                                onError: () => onLcpHeroImageError?.(),
                              }
                            : {})}
                        />
                        {item.slideDeckPngAdMark ? (
                          <span className={siteStyles.slideDeckPngAdMark} aria-hidden>
                            AD
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {shortcutSelected}
        </div>
      </div>
    );
  }

  const phBg = item.faceCssBackground?.trim() || "#0f172a";
  return (
    <div {...slotShellProps}>
      <div
        className={`${styles.sampleMainCardFace} ${styles.sampleMainCardFaceTournamentDeck} ${selected ? styles.sampleMainCardFaceSelected : ""}`}
      >
        <div className={siteStyles.cardRowInteractionWrap} onPointerDown={onPointerDown}>
          <div className={styles.sampleMainCardDeckFit}>
            <div className={styles.sampleMainCardDeckFitInner}>
              <div className={siteStyles.mainScrollDeckCardShell}>
                <div
                  className={`${deckShellStyles.mainScrollDeckCardOuter} ${deckShellStyles.mainScrollDeckCardOuterFlex}${selected ? ` ${deckShellStyles.mainScrollDeckCardOuterSelected}` : ""}`}
                >
                  <div
                    className={`${deckShellStyles.mainScrollDeckCardInner} ${deckShellStyles.mainScrollDeckCardInnerFlex}`}
                  >
                    <div className={styles.sampleMainCardPublishedInner} style={{ background: phBg }} aria-hidden>
                      {item.slideDeckPngAdMark ? (
                        <span className={siteStyles.slideDeckPngAdMark} aria-hidden>
                          AD
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {shortcutSelected}
      </div>
    </div>
  );
});

export type MainSiteScrollCardsProps = {
  items: MainSiteScrollCardItem[];
  /** `MainSlideAdConfig.cardMoveDurationSec` — 저장 키는 레거시 이름, 값은 1~10 속도 단계(서버에서 정규화). */
  slideCardMoveSpeedLevel: number;
};

export function MainSiteScrollCards({ items, slideCardMoveSpeedLevel }: MainSiteScrollCardsProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [autoSlideReady, setAutoSlideReady] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const primarySegmentRef = useRef<HTMLDivElement | null>(null);
  const secondarySegmentRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const autoDeselectTimerRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const pausedByUserRef = useRef(false);
  const programmaticScrollUntilMsRef = useRef(0);
  /** sessionStorage 복원 직후 자동 슬라이드가 scrollTop을 덮어쓰지 않도록 */
  const restoreSettleUntilMsRef = useRef(0);
  /** 이번 마운트에서 세션 복원을 적용했으면 자동 슬라이드 준비 지연을 늘림 */
  const sessionRestoreAppliedRef = useRef(false);
  /** `pxPerSec * dt` + carry; 매 프레임 `deltaTotal % 1`을 다음 carry로 유지 */
  const scrollPixelCarryRef = useRef(0);

  const lcpHeroItemIndex = useMemo(
    () => items.findIndex((x) => Boolean(x.imageUrl?.trim()) && !x.slideDeckPngPlaceholder),
    [items],
  );
  const initialPriorityIndexes = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const hasDeckImage = Boolean(items[i]?.imageUrl?.trim()) && !items[i]?.slideDeckPngPlaceholder;
      if (!hasDeckImage) continue;
      out.push(i);
      if (out.length >= 3) break;
    }
    return out;
  }, [items]);

  const itemsIdsKey = items.length > 0 ? mainScrollIdsKey(items) : "";

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    logMainCardReturnDiag({ phase: "scroll-cards-mount", path, itemsLen: items.length, itemsIdsKey });
    return () => {
      logMainCardReturnDiag({
        phase: "scroll-cards-unmount",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        itemsLen: itemsRef.current.length,
        itemsIdsKey: itemsRef.current.length > 0 ? mainScrollIdsKey(itemsRef.current) : "",
      });
    };
  }, []);

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const sample = items.slice(0, 4).map((it) => ({
      id: it.id,
      titleLen: (it.title ?? "").length,
      hasImageUrl: Boolean(it.imageUrl?.trim()),
      placeholder: Boolean(it.slideDeckPngPlaceholder),
      pngFace: Boolean(it.slideDeckPngFace),
    }));
    logMainCardReturnDiag({
      phase: "scroll-cards-items",
      path,
      itemsLen: items.length,
      itemsIdsKey,
      sample,
    });
  }, [items, itemsIdsKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPageShow = (ev: PageTransitionEvent) => {
      logMainCardReturnDiag({
        phase: "window-pageshow",
        persisted: ev.persisted,
        path: window.location.pathname,
        itemsLen: itemsRef.current.length,
        itemsIdsKey: itemsRef.current.length > 0 ? mainScrollIdsKey(itemsRef.current) : "",
      });
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const mountLoggedRef = useRef(false);
  const lcpHeroLoadLoggedRef = useRef(false);

  useEffect(() => {
    if (!isMainSiteLoadDiagEnabled() || mountLoggedRef.current) return;
    mountLoggedRef.current = true;
    const first = items[lcpHeroItemIndex >= 0 ? lcpHeroItemIndex : 0];
    logMainSiteLoadDiag("client-scroll", "MainSiteScrollCards mounted", {
      itemCount: items.length,
      lcpHeroItemIndex,
      firstCardImageUrlPresent: Boolean(first?.imageUrl?.trim()),
      firstCardId: first?.id ?? null,
    });
  }, [items, lcpHeroItemIndex]);

  const onLcpHeroImageLoad = useCallback(() => {
    if (!isMainSiteLoadDiagEnabled() || lcpHeroLoadLoggedRef.current) return;
    lcpHeroLoadLoggedRef.current = true;
    const hero = lcpHeroItemIndex >= 0 ? items[lcpHeroItemIndex] : items[0];
    logMainSiteLoadDiag("client-scroll", "first card image load success", {
      itemId: hero?.id ?? null,
      imageUrl: hero?.imageUrl?.trim() ?? "",
    });
  }, [items, lcpHeroItemIndex]);

  const onLcpHeroImageError = useCallback(() => {
    if (!isMainSiteLoadDiagEnabled() || lcpHeroLoadLoggedRef.current) return;
    lcpHeroLoadLoggedRef.current = true;
    const hero = lcpHeroItemIndex >= 0 ? items[lcpHeroItemIndex] : items[0];
    logMainSiteLoadDiag("client-scroll", "first card image load failed", {
      itemId: hero?.id ?? null,
      imageUrl: hero?.imageUrl?.trim() ?? "",
    });
  }, [items, lcpHeroItemIndex]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (items.length === 0 || !itemsIdsKey) {
      logMainCardReturnDiag({
        phase: "session-restore-skip",
        reason: items.length === 0 ? "empty-items" : "empty-ids-key",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        itemsLen: items.length,
        itemsIdsKey,
      });
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;

    sessionRestoreAppliedRef.current = false;
    restoreSettleUntilMsRef.current = 0;

    let parsed:
      | (MainSiteScrollStoredV1 & { progressRatio?: number })
      | (MainSiteScrollStoredV2 & { progressRatio: number })
      | null = null;
    try {
      const raw = sessionStorage.getItem(MAIN_SITE_SCROLL_STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw) as Partial<MainSiteScrollStoredV2> & Partial<MainSiteScrollStoredV1>;
        if (o?.v === 1 && typeof o.idsKey === "string" && typeof o.scrollTop === "number") {
          parsed = { v: 1, idsKey: o.idsKey, scrollTop: o.scrollTop };
        } else if (
          o?.v === 2 &&
          typeof o.idsKey === "string" &&
          typeof o.scrollTop === "number" &&
          typeof o.progressRatio === "number"
        ) {
          parsed = {
            v: 2,
            idsKey: o.idsKey,
            scrollTop: o.scrollTop,
            progressRatio: o.progressRatio,
          };
        }
      }
    } catch {
      parsed = null;
    }
    if (!parsed) {
      logMainCardReturnDiag({
        phase: "session-restore-skip",
        reason: "no-parseable-session",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        itemsLen: items.length,
        itemsIdsKey,
      });
      return;
    }

    const idsMatch = parsed.idsKey === itemsIdsKey;
    logMainCardReturnDiag({
      phase: "session-restore-apply",
      path: typeof window !== "undefined" ? window.location.pathname : "",
      itemsLen: items.length,
      itemsIdsKey,
      storedIdsKeyLen: parsed.idsKey.length,
      idsMatch,
      scrollTopStored: parsed.scrollTop,
      progressRatioStored: "progressRatio" in parsed ? parsed.progressRatio : null,
      storageV: parsed.v,
    });

    sessionRestoreAppliedRef.current = true;
    const settleUntil = performance.now() + 900;
    restoreSettleUntilMsRef.current = settleUntil;

    const targetFromRatio = () => {
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const ratio = Math.min(1, Math.max(0, Number(parsed?.progressRatio ?? NaN)));
      if (!Number.isFinite(ratio)) return null;
      return maxScroll * ratio;
    };
    const target =
      parsed.idsKey === itemsIdsKey
        ? parsed.scrollTop
        : targetFromRatio() ?? parsed.scrollTop;

    const apply = () => {
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const nextTop = Math.min(Math.max(0, target), maxScroll);
      viewport.scrollTop = nextTop;
      const now = performance.now();
      programmaticScrollUntilMsRef.current = Math.max(programmaticScrollUntilMsRef.current, now + 900);
      restoreSettleUntilMsRef.current = Math.max(restoreSettleUntilMsRef.current, now + 250);
    };

    apply();
    let rafOuter: number | null = requestAnimationFrame(() => {
      rafOuter = null;
      apply();
      requestAnimationFrame(() => {
        apply();
        requestAnimationFrame(() => {
          apply();
        });
      });
    });

    let ro: ResizeObserver | null = null;
    let roTimer: number | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        apply();
      });
      ro.observe(viewport);
      roTimer = window.setTimeout(() => {
        ro?.disconnect();
        ro = null;
      }, 2500);
    }

    const retryDelaysMs = [80, 160, 320, 500];
    const retryTimers = retryDelaysMs.map((ms) => window.setTimeout(() => apply(), ms));

    return () => {
      if (rafOuter != null) cancelAnimationFrame(rafOuter);
      retryTimers.forEach((t) => window.clearTimeout(t));
      if (roTimer != null) window.clearTimeout(roTimer);
      ro?.disconnect();
    };
  }, [items.length, itemsIdsKey]);

  const clearCardSelection = useCallback(() => {
    setSelectedItemId(null);
  }, []);

  const clearAutoDeselectTimer = useCallback(() => {
    if (autoDeselectTimerRef.current !== null) {
      window.clearTimeout(autoDeselectTimerRef.current);
      autoDeselectTimerRef.current = null;
    }
  }, []);

  const scheduleAutoDeselect = useCallback(() => {
    clearAutoDeselectTimer();
    autoDeselectTimerRef.current = window.setTimeout(() => {
      autoDeselectTimerRef.current = null;
      clearCardSelection();
    }, MAIN_SITE_CARD_AUTO_DESELECT_MS);
  }, [clearAutoDeselectTimer, clearCardSelection]);

  const onCardPointerDown = useCallback((itemId: string) => {
    setSelectedItemId((prev) => {
      if (prev === null) return itemId;
      if (prev === itemId) return null;
      return null;
    });
  }, []);

  useEffect(() => {
    if (selectedItemId === null) {
      clearAutoDeselectTimer();
      return;
    }
    scheduleAutoDeselect();
    const viewport = viewportRef.current;
    if (!viewport) {
      return () => clearAutoDeselectTimer();
    }
    const bumpAutoDeselect = () => scheduleAutoDeselect();
    viewport.addEventListener("touchstart", bumpAutoDeselect, { passive: true });
    viewport.addEventListener("touchmove", bumpAutoDeselect, { passive: true });
    viewport.addEventListener("wheel", bumpAutoDeselect, { passive: true });
    viewport.addEventListener("pointerdown", bumpAutoDeselect, { passive: true });
    viewport.addEventListener("scroll", bumpAutoDeselect, { passive: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") bumpAutoDeselect();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearAutoDeselectTimer();
      viewport.removeEventListener("touchstart", bumpAutoDeselect);
      viewport.removeEventListener("touchmove", bumpAutoDeselect);
      viewport.removeEventListener("wheel", bumpAutoDeselect);
      viewport.removeEventListener("pointerdown", bumpAutoDeselect);
      viewport.removeEventListener("scroll", bumpAutoDeselect);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clearAutoDeselectTimer, scheduleAutoDeselect, selectedItemId]);

  useEffect(() => {
    if (selectedItemId === null) return;
    const onDocPointerDownCapture = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest(`[${SITE_SCROLL_CARD}]`)) return;
      if (el.closest(`[${SITE_SCROLL_SHORTCUT}]`)) return;
      clearCardSelection();
    };
    document.addEventListener("pointerdown", onDocPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDownCapture, true);
  }, [clearCardSelection, selectedItemId]);

  useEffect(() => {
    if (items.length === 0) {
      setAutoSlideReady(false);
      return;
    }
    let cancelled = false;
    const delayMs = sessionRestoreAppliedRef.current ? 900 : 220;
    logMainCardReturnDiag({
      phase: "auto-slide-ready-schedule",
      path: typeof window !== "undefined" ? window.location.pathname : "",
      delayMs,
      sessionRestoreApplied: sessionRestoreAppliedRef.current,
      itemsLen: items.length,
      itemsIdsKey,
    });
    const timer = window.setTimeout(() => {
      if (!cancelled) setAutoSlideReady(true);
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setAutoSlideReady(false);
    };
  }, [itemsIdsKey, items.length]);

  /** 탭 이동·복귀 시에도 스크롤 위치가 반영되도록 언마운트만이 아닌 스크롤 중 저장 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = viewportRef.current;
    if (!node || items.length === 0 || !itemsIdsKey) return;
    const idsKey = itemsIdsKey;
    let throttleTimer: number | null = null;
    const flush = () => {
      throttleTimer = null;
      if (performance.now() < restoreSettleUntilMsRef.current) return;
      try {
        const maxScroll = Math.max(1, node.scrollHeight - node.clientHeight);
        const payload: MainSiteScrollStoredV2 = {
          v: 2,
          idsKey,
          scrollTop: node.scrollTop,
          progressRatio: Math.min(1, Math.max(0, node.scrollTop / maxScroll)),
        };
        sessionStorage.setItem(MAIN_SITE_SCROLL_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    };
    const onScroll = () => {
      if (throttleTimer != null) return;
      throttleTimer = window.setTimeout(flush, 200);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", onScroll);
      if (throttleTimer != null) window.clearTimeout(throttleTimer);
    };
  }, [itemsIdsKey, items.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (items.length === 0) return;
    if (!autoSlideReady) return;

    logMainCardReturnDiag({
      phase: "marquee-raf-effect-start",
      path: typeof window !== "undefined" ? window.location.pathname : "",
      itemsLen: items.length,
      itemsIdsKey,
      slideCardMoveSpeedLevel,
      autoSlideReady,
    });

    const speedLevel = Number.isFinite(slideCardMoveSpeedLevel)
      ? Math.min(10, Math.max(1, Math.round(slideCardMoveSpeedLevel)))
      : 5;
    /** 5단계에서 뷰포트 한 높이 정도 이동 체감 ≈ 8~10초가 되도록 잡는 기준(초) */
    const baseTravelSec = 9;
    const fallbackPxPerSec = 24;
    const restartAfterUserInputMs = 2000;
    const readSegmentHeight = () => {
      const start = primarySegmentRef.current;
      if (!start) return 0;
      let total = 0;
      let el: Element | null = start;
      for (let i = 0; i < itemsRef.current.length && el; i++) {
        if (!(el instanceof HTMLElement)) break;
        total += el.offsetHeight;
        el = el.nextElementSibling;
      }
      return Number.isFinite(total) && total > 0 ? total : 0;
    };

    const stopAutoSlide = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (measureFrameRef.current !== null) {
        cancelAnimationFrame(measureFrameRef.current);
        measureFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
      scrollPixelCarryRef.current = 0;
    };

    const scheduleResume = () => {
      if (selectedItemId !== null) return;
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
      pausedByUserRef.current = true;
      stopAutoSlide();
      resumeTimerRef.current = window.setTimeout(() => {
        if (selectedItemId !== null) return;
        pausedByUserRef.current = false;
        startAutoSlide();
      }, restartAfterUserInputMs);
    };

    const onUserInput = () => {
      scheduleResume();
    };

    const onScroll = () => {
      if (performance.now() <= programmaticScrollUntilMsRef.current) return;
      scheduleResume();
    };

    const scheduleMeasureRetry = () => {
      if (measureFrameRef.current !== null) return;
      let tries = 3;
      const tick = () => {
        measureFrameRef.current = null;
        if (readSegmentHeight() > 0) {
          return;
        }
        if (tries <= 0) return;
        tries -= 1;
        measureFrameRef.current = requestAnimationFrame(tick);
      };
      measureFrameRef.current = requestAnimationFrame(tick);
    };

    const step = (frameTime: number) => {
      const node = viewportRef.current;
      if (!node || pausedByUserRef.current || selectedItemId !== null) {
        stopAutoSlide();
        return;
      }
      const segmentHeight = readSegmentHeight();
      const maxScrollTop = node.scrollHeight - node.clientHeight;
      if (maxScrollTop <= 0) {
        if (segmentHeight <= 0) scheduleMeasureRetry();
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (performance.now() < restoreSettleUntilMsRef.current) {
        lastFrameTimeRef.current = frameTime;
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const prevTime = lastFrameTimeRef.current ?? frameTime;
      const dtSec = Math.max(0, (frameTime - prevTime) / 1000);
      lastFrameTimeRef.current = frameTime;

      const trackStart = trackRef.current?.offsetTop ?? 0;
      const primaryOffset = primarySegmentRef.current?.offsetTop ?? 0;
      const firstStart = trackStart + primaryOffset;
      const clientH = node.clientHeight;
      let pxPerSec = fallbackPxPerSec;
      let speedSource: "viewport" | "fallback" = "fallback";
      if (clientH > 0) {
        pxPerSec = (clientH * speedLevel) / (baseTravelSec * 5);
        speedSource = "viewport";
      }
      if (!Number.isFinite(pxPerSec) || pxPerSec <= 0) {
        pxPerSec = fallbackPxPerSec;
        speedSource = "fallback";
      }
      const secondaryOffset = secondarySegmentRef.current?.offsetTop ?? 0;
      const secondStart = trackStart + secondaryOffset;
      const hasOffsetLoopWindow = secondStart > firstStart;
      const loopDistance = hasOffsetLoopWindow
        ? secondStart - firstStart
        : segmentHeight > 0
          ? segmentHeight
          : Math.max(maxScrollTop, 1);
      const loopEnd = hasOffsetLoopWindow ? secondStart : firstStart + loopDistance;
      const carryBefore = scrollPixelCarryRef.current;
      const deltaTotal = pxPerSec * dtSec + carryBefore;
      scrollPixelCarryRef.current = deltaTotal % 1;
      let nextScrollTop = node.scrollTop + deltaTotal;
      while (nextScrollTop >= loopEnd && loopDistance > 0) {
        nextScrollTop -= loopDistance;
      }
      /**
       * 루프 보정 후 좌표가 상단 리드인(spacer)으로 떨어지지 않도록
       * 카드 세그먼트 시작점 이상으로 고정.
       */
      if (loopDistance > 0 && nextScrollTop < firstStart) {
        nextScrollTop = firstStart + ((nextScrollTop - firstStart) % loopDistance + loopDistance) % loopDistance;
      }

      const appliedScrollTop = Math.min(nextScrollTop, maxScrollTop);
      // programmatic scrollTop 변경 직후 발생하는 scroll 이벤트를 사용자 입력으로 오인하지 않도록 보호
      programmaticScrollUntilMsRef.current = performance.now() + 160;
      node.scrollTop = appliedScrollTop;

      rafRef.current = requestAnimationFrame(step);
    };

    const startAutoSlide = () => {
      if (pausedByUserRef.current) return;
      if (selectedItemId !== null) return;
      if (rafRef.current !== null) return;
      lastFrameTimeRef.current = null;
      scrollPixelCarryRef.current = 0;
      rafRef.current = requestAnimationFrame(step);
    };

    viewport.addEventListener("touchstart", onUserInput, { passive: true });
    viewport.addEventListener("touchmove", onUserInput, { passive: true });
    viewport.addEventListener("wheel", onUserInput, { passive: true });
    viewport.addEventListener("pointerdown", onUserInput, { passive: true });
    viewport.addEventListener("scroll", onScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (readSegmentHeight() <= 0) scheduleMeasureRetry();
      });
      if (trackRef.current) resizeObserver.observe(trackRef.current);
      resizeObserver.observe(viewport);
    }

    if (selectedItemId !== null) {
      pausedByUserRef.current = true;
      stopAutoSlide();
    } else {
      pausedByUserRef.current = false;
      if (readSegmentHeight() <= 0) scheduleMeasureRetry();
      startAutoSlide();
    }

    return () => {
      try {
        const node = viewportRef.current;
        if (node && itemsRef.current.length > 0) {
          const maxScroll = Math.max(1, node.scrollHeight - node.clientHeight);
          const payload: MainSiteScrollStoredV2 = {
            v: 2,
            idsKey: mainScrollIdsKey(itemsRef.current),
            scrollTop: node.scrollTop,
            progressRatio: Math.min(1, Math.max(0, node.scrollTop / maxScroll)),
          };
          sessionStorage.setItem(MAIN_SITE_SCROLL_STORAGE_KEY, JSON.stringify(payload));
          logMainCardReturnDiag({
            phase: "marquee-raf-effect-cleanup-save-session",
            path: typeof window !== "undefined" ? window.location.pathname : "",
            idsKeyLen: payload.idsKey.length,
            scrollTop: payload.scrollTop,
            progressRatio: payload.progressRatio,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
          });
        }
      } catch {
        /* 저장 공간 부족 등 */
      }
      viewport.removeEventListener("touchstart", onUserInput);
      viewport.removeEventListener("touchmove", onUserInput);
      viewport.removeEventListener("wheel", onUserInput);
      viewport.removeEventListener("pointerdown", onUserInput);
      viewport.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
      stopAutoSlide();
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      pausedByUserRef.current = false;
      programmaticScrollUntilMsRef.current = 0;
      scrollPixelCarryRef.current = 0;
    };
  }, [itemsIdsKey, items.length, slideCardMoveSpeedLevel, selectedItemId, autoSlideReady]);

  if (items.length === 0) {
    return (
      <div className={styles.slideViewportSiteMain} data-no-root-swipe data-site-main-scroll-viewport="1">
        <p className={styles.sampleMainEmpty}>등록된 메인 카드가 없습니다.</p>
      </div>
    );
  }

  const renderSegment = (segmentKey: string, segmentRootRef?: Ref<HTMLDivElement>) => (
    <div
      className={`${styles.sampleMainMarqueeSegment} ${siteStyles.segmentMarqueeContents}`}
      key={segmentKey}
    >
      {items.map((item, itemIndex) => {
        const rowKey = `${segmentKey}-${item.id}`;
        const lcpHeroImage =
          segmentKey === "a" && itemIndex === lcpHeroItemIndex && lcpHeroItemIndex >= 0;
        const prioritizeNearViewportImage =
          segmentKey === "a" && initialPriorityIndexes.includes(itemIndex);
        return (
          <div
            key={rowKey}
            className={siteStyles.marqueeCardSlotShell}
            ref={itemIndex === 0 ? segmentRootRef : undefined}
          >
            <MainSiteCardRow
              rowKey={rowKey}
              item={item}
              selected={selectedItemId === item.id}
              onCardPointerDown={onCardPointerDown}
              onShortcutActivate={clearAutoDeselectTimer}
              lcpHeroImage={lcpHeroImage}
              prioritizeNearViewportImage={prioritizeNearViewportImage}
              onLcpHeroImageLoad={lcpHeroImage ? onLcpHeroImageLoad : undefined}
              onLcpHeroImageError={lcpHeroImage ? onLcpHeroImageError : undefined}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`${styles.slideViewportSiteMain} ${siteStyles.viewportMarquee} ${siteStyles.viewportMarqueeLeadIn}`}
      data-no-root-swipe
      data-site-main-scroll-viewport="1"
      data-site-main-scroll-deck="1"
      ref={viewportRef}
    >
      <div
        ref={trackRef}
        className={`${styles.sampleMainMarqueeTrack} ${siteStyles.trackScrollStatic}`}
      >
        {renderSegment("a", primarySegmentRef)}
        {renderSegment("b", secondarySegmentRef)}
        {selectedItemId !== null ? (
          <div className={siteStyles.trackDimOverlay} aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
