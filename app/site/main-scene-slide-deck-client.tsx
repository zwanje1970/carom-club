"use client";

import { useEffect, useState, type ComponentProps } from "react";
import MainSceneSlideDeck from "./main-scene-slide-deck";
import styles from "./main-scene-slide-deck.module.css";

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
    const label = props.sectionLabel?.trim() || "진행중 대회";
    return (
      <div aria-hidden className={styles.slideDeck}>
        <p className={styles.slideDeckLabel}>{label}</p>
      </div>
    );
  }

  return <MainSceneSlideDeck {...props} />;
}
