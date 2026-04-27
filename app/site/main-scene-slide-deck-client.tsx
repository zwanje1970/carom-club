"use client";

import { useEffect, useState, type ComponentProps } from "react";
import MainSceneSlideDeck from "./main-scene-slide-deck";
import styles from "./main-scene-slide-deck.module.css";
import "./slide-deck-template.css";

type Props = ComponentProps<typeof MainSceneSlideDeck>;

/**
 * 서버 HTML에는 시간 기반 스타일을 만들지 않기 위해, 마운트 후에만 실제 덱을 렌더한다.
 */
export default function MainSceneSlideDeckClient(props: Props) {
  const [mounted, setMounted] = useState(false);
  /** 데스크톱 UA + 좁은 창(반응형): 모바일과 동일 incoming 오프셋 — UA만으로는 뷰포트와 불일치 */
  const [narrowViewport, setNarrowViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const syncNarrow = () => setNarrowViewport(mq.matches);
    syncNarrow();
    mq.addEventListener("change", syncNarrow);
    return () => mq.removeEventListener("change", syncNarrow);
  }, []);

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
    const bottomOverlay =
      props.homeBottomOverlay != null ? (
        <div
          className={styles.slideDeckBottomOverlay}
          role="region"
          aria-label="메인 바로가기(임시 PNG)"
        >
          <div className={styles.slideDeckBottomOverlayInner}>
            <div className={styles.slideDeckBottomOverlayBar}>
              <div className={`${styles.slideDeckBottomOverlayRow} temp-png-button-tuning`}>
                {props.homeBottomOverlay}
              </div>
            </div>
          </div>
        </div>
      ) : null;
    return (
      <div className={styles.slideDeckShell}>
        <div className={`slide-deck-wrap ${styles.slideDeckWrapWithNoticeGap}`}>
          <div className={styles.slideDeckFrame}>
            <div aria-hidden className="slide-deck">
              {noticeAbove}
              {cardChrome}
            </div>
          </div>
          {bottomOverlay}
        </div>
      </div>
    );
  }

  return (
    <MainSceneSlideDeck
      {...props}
      incomingFromBottomUi={props.incomingFromBottomUi || narrowViewport}
    />
  );
}
