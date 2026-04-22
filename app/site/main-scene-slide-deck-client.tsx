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

  useEffect(() => {
    setMounted(true);
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
      <div className={styles.slideDeckCardChrome}>
        <div className={styles.slideDeckTopChrome}>
          {label ? <p className={styles.slideDeckLabel}>{label}</p> : null}
        </div>
        <div className={styles.slideDeckBottomDots} aria-hidden="true">
          <span className={styles.slideDeckBottomDotY}>●</span>
          <span className={styles.slideDeckBottomDotR}>●</span>
          <span className={styles.slideDeckBottomDotW}>●</span>
        </div>
      </div>
    );
    return (
      <div className={styles.slideDeckShell}>
        <div className={`slide-deck-wrap ${styles.slideDeckWrapWithNoticeGap}`}>
          {noticeAbove}
          <div aria-hidden className="slide-deck">
            {cardChrome}
          </div>
        </div>
      </div>
    );
  }

  return <MainSceneSlideDeck {...props} />;
}
