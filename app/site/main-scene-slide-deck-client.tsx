"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type ComponentProps } from "react";
import MainSceneSlideDeck from "./main-scene-slide-deck";
import styles from "./main-scene-slide-deck.module.css";
import type { SlideDeckItem } from "./tournament-snapshot-card-view";

type Props = ComponentProps<typeof MainSceneSlideDeck>;

function slideUsesDeckBackgroundImage(item: SlideDeckItem): boolean {
  const isAd = item.type === "ad";
  return isAd
    ? Boolean(item.image320Url?.trim())
    : item.backgroundType !== "theme" && Boolean(item.image320Url?.trim());
}

function heroSlideIndex(n: number): number {
  if (n <= 1) return 0;
  return 1 % n;
}

/**
 * 서버 HTML에는 시간 기반 스타일을 만들지 않기 위해, 마운트 후에만 실제 덱을 렌더한다.
 */
export default function MainSceneSlideDeckClient(props: Props) {
  const [mounted, setMounted] = useState(false);
  const [narrowViewport, setNarrowViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  const n = props.items.length;
  const heroIdx = n > 0 ? heroSlideIndex(n) : 0;
  const heroItem = n > 0 ? props.items[heroIdx] : null;
  const heroImageUrl =
    heroItem && slideUsesDeckBackgroundImage(heroItem) ? (heroItem.image320Url ?? "").trim() : "";

  const [sceneClockReady, setSceneClockReady] = useState(() => {
    if (n === 0 || !heroItem) return true;
    return !slideUsesDeckBackgroundImage(heroItem);
  });

  const heroSignature = heroItem ? `${n}:${heroItem.snapshotId}:${heroImageUrl}` : "";

  useLayoutEffect(() => {
    if (!mounted) return;
    const len = props.items.length;
    if (len === 0) {
      setSceneClockReady(true);
      return;
    }
    const idx = heroSlideIndex(len);
    const it = props.items[idx];
    setSceneClockReady(!slideUsesDeckBackgroundImage(it));
  }, [mounted, heroSignature]);

  const onHeroBackgroundImageLoad = useCallback(() => {
    setSceneClockReady(true);
  }, []);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const syncNarrow = () => setNarrowViewport(mq.matches);
    syncNarrow();
    mq.addEventListener("change", syncNarrow);
    return () => mq.removeEventListener("change", syncNarrow);
  }, []);

  useEffect(() => {
    if (!mounted || !heroImageUrl) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = heroImageUrl;
    link.setAttribute("fetchpriority", "high");
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [mounted, heroImageUrl]);

  if (!mounted) {
    const label = props.sectionLabel?.trim() ?? "";
    const notice = props.siteNoticeText?.trim();
    const noticeAbove = notice ? (
      <div className={styles.slideDeckNoticeAbove}>
        <div className={styles.slideDeckNoticeWrap}>
          <div className={styles.slideDeckNotice}>
            <span className={styles.slideDeckNoticeMarquee}>{notice}</span>
          </div>
        </div>
      </div>
    ) : null;
    const cardChrome = (
      <div
        className={[styles.slideDeckCardChrome, props.items.length > 0 ? styles.slideDeckCardChromeDocked : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.slideDeckTopChrome}>
          {label ? <p className={styles.slideDeckLabel}>{label}</p> : null}
        </div>
      </div>
    );
    return (
      <div className={styles.slideDeckShell}>
        <div className={`slide-deck-wrap ${styles.slideDeckWrapWithNoticeGap}`}>
          <div className={styles.slideDeckFrame}>
            <div aria-hidden className="slide-deck">
              {noticeAbove}
              {cardChrome}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MainSceneSlideDeck
      key={heroSignature || "empty"}
      {...props}
      incomingFromBottomUi={props.incomingFromBottomUi || narrowViewport}
      sceneClockReady={sceneClockReady}
      onHeroBackgroundImageLoad={onHeroBackgroundImageLoad}
    />
  );
}
