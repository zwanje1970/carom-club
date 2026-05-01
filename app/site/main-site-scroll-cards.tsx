"use client";

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import editorCardStyles from "../client/tournaments/[id]/card-publish-editor.module.css";
import styles from "./main-sample/main-sample.module.css";
import siteStyles from "./main-site-scroll-cards.module.css";
import {
  SLIDE_DECK_SOLID_BACKDROPS,
  TournamentSnapshotCardView,
  type SlideDeckItem,
} from "./tournament-snapshot-card-view";

const SITE_SCROLL_CARD = "data-site-scroll-card";
const SITE_SCROLL_SHORTCUT = "data-site-scroll-shortcut";

export type MainSiteScrollCardItem = {
  id: string;
  href: string;
  title: string;
  imageUrl: string | null;
  /** 이미지 없을 때 카드 면 배경(CSS `background` 값) */
  faceCssBackground: string | null;
  external: boolean;
  /** 게시 스냅샷으로 면 전체가 이미지일 때 제목 오버레이 숨김(중복 방지) */
  faceIsFullPublishedSnapshot?: boolean;
  /**
   * 게시 PNG 분기(`faceIsFullPublishedSnapshot`)는 아니지만, 면·포스터 크기·비율은
   * 게시 카드와 동일 CSS(공통 토큰) 사용 — 광고 업로드 이미지 전용.
   */
  faceMatchPublishedScrollMetrics?: boolean;
  /** 게시/광고 풀면레이아웃: HTML 텍스트(배지·제목·부가) — 이미지는 배경만 */
  scrollFaceBadge?: string | null;
  scrollFaceSubtitle?: string | null;
  scrollFaceExtraLine1?: string | null;
  scrollFaceExtraLine2?: string | null;
  scrollFaceExtraLine3?: string | null;
  scrollFaceTitleColor?: string | null;
  scrollFaceMetaColor?: string | null;
  scrollFaceStrongTextShadow?: boolean;
  /** 대회 카드: 작성화면과 동일 컴포넌트로 렌더(광고 등은 미사용) */
  slideDeckItem?: SlideDeckItem;
};

function publishedScrollBadgeClass(badge: string): string {
  const b = badge.trim();
  if (!b) return "site-board-status-badge site-board-status-badge--muted";
  if (b === "광고") return "site-board-status-badge site-board-status-badge--muted";
  if (b.includes("마감임박") || (b.includes("마감") && b.includes("임박")))
    return "site-board-status-badge site-board-status-badge--urgent";
  if (b.includes("마감")) return "site-board-status-badge site-board-status-badge--closed";
  if (b.includes("종료")) return "site-board-status-badge site-board-status-badge--ended";
  if (b.includes("모집") || b.includes("진행")) return "site-board-status-badge badge-status";
  return "site-board-status-badge site-board-status-badge--muted";
}

function isDudMetaLine(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return /^[·\s.|\-–—]+$/u.test(t);
}

function publishedScrollMetaLines(
  subtitle: string | null | undefined,
  e1: string | null | undefined,
  e2: string | null | undefined,
  e3: string | null | undefined,
): string[] {
  const out: string[] = [];
  const pushUnique = (s: string) => {
    const t = s.trim();
    if (!t || isDudMetaLine(t) || out.includes(t)) return;
    out.push(t);
  };
  pushUnique(subtitle ?? "");
  pushUnique(e1 ?? "");
  pushUnique(e2 ?? "");
  pushUnique(e3 ?? "");
  return out.slice(0, 3);
}

type CardRowProps = {
  rowKey: string;
  item: MainSiteScrollCardItem;
  selected: boolean;
  onCardPointerDown: (itemId: string) => void;
  /** 문서 순서상 첫 번째 면 이미지(LCP 후보) — 링크 preload 없이 img 우선순위만 부여 */
  lcpHeroImage?: boolean;
};

const MainSiteCardRow = memo(function MainSiteCardRow({
  rowKey,
  item,
  selected,
  onCardPointerDown,
  lcpHeroImage = false,
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

  if (item.slideDeckItem) {
    const sd = item.slideDeckItem;
    const deckInner = (
      <TournamentSnapshotCardView
        item={sd}
        slideDeck
        templateCardLayout
        editorCompactCardHeight
        suppressLink
        repImageHighPriority={lcpHeroImage}
        slideDeckSolidBackdrop={SLIDE_DECK_SOLID_BACKDROPS[0]}
      />
    );
    return (
      <div
        className={`${styles.sampleMainCardSlot} ${selected ? styles.sampleMainCardSlotSelected : ""}`}
        {...{ [SITE_SCROLL_CARD]: "" }}
        style={{ touchAction: "pan-y" }}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${item.title}${selected ? ", 선택됨" : ""}`}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onCardPointerDown(item.id);
        }}
      >
        <div
          className={`${styles.sampleMainCardFace} ${styles.sampleMainCardFaceTournamentDeck} ${selected ? styles.sampleMainCardFaceSelected : ""}`}
        >
          <div className={siteStyles.cardRowInteractionWrap} onPointerDown={onPointerDown}>
            <div className={styles.sampleMainCardDeckFit}>
              <div className={styles.sampleMainCardDeckFitInner}>
                <div className={editorCardStyles.previewCardScaleHost}>
                  <div className={editorCardStyles.previewCardScaleInner}>
                    <div
                      className={`${editorCardStyles.previewCardWrap} ${editorCardStyles.previewCardWrapV2Chrome}`}
                    >
                      <div className={editorCardStyles.cardPublishCaptureRoot}>{deckInner}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {selected ? (
            item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sampleMainCardShortcut}
                {...{ [SITE_SCROLL_SHORTCUT]: "" }}
                tabIndex={0}
                onPointerDown={(e) => e.stopPropagation()}
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
                onPointerDown={(e) => e.stopPropagation()}
              >
                자세히 보기 ▶
              </Link>
            )
          ) : null}
        </div>
      </div>
    );
  }

  const hasFaceImage = Boolean(item.imageUrl?.trim());
  const usePublishedScrollLayout = Boolean(
    (item.faceIsFullPublishedSnapshot && hasFaceImage) ||
      (item.faceMatchPublishedScrollMetrics && hasFaceImage),
  );

  const faceStyle: CSSProperties = {};
  if (!item.imageUrl?.trim() && item.faceCssBackground?.trim()) {
    faceStyle.background = item.faceCssBackground.trim();
  }

  const textShadowBase = item.scrollFaceStrongTextShadow
    ? "0 1px 2px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.45)"
    : "0 1px 2px rgba(0,0,0,0.65)";
  const titleColor = item.scrollFaceTitleColor?.trim() || "#ffffff";
  const metaColor = item.scrollFaceMetaColor?.trim() || "rgba(255,255,255,0.92)";
  const metaLines = publishedScrollMetaLines(
    item.scrollFaceSubtitle,
    item.scrollFaceExtraLine1,
    item.scrollFaceExtraLine2,
    item.scrollFaceExtraLine3,
  );
  const overlayTextShadow = item.scrollFaceStrongTextShadow ? textShadowBase : "none";

  return (
    <div
      className={`${styles.sampleMainCardSlot} ${selected ? styles.sampleMainCardSlotSelected : ""}`}
      {...{ [SITE_SCROLL_CARD]: "" }}
      style={{ touchAction: "pan-y" }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.title}${selected ? ", 선택됨" : ""}`}
      onPointerDown={onPointerDown}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onCardPointerDown(item.id);
      }}
    >
      <div
        className={
          usePublishedScrollLayout
            ? `${styles.sampleMainCardFacePublishedSnapshot} ${selected ? styles.sampleMainCardFacePublishedSnapshotSelected : ""}`
            : `${styles.sampleMainCardFace} ${selected ? styles.sampleMainCardFaceSelected : ""}`
        }
        style={faceStyle}
      >
        {usePublishedScrollLayout && item.imageUrl?.trim() ? (
          <div className={styles.sampleMainCardPublishedInner}>
            <img
              src={item.imageUrl.trim()}
              alt=""
              className={styles.sampleMainCardPosterPublishedSnapshot}
              decoding="async"
              loading={lcpHeroImage ? "eager" : "lazy"}
              {...(lcpHeroImage ? { fetchPriority: "high" as const } : {})}
            />
            <div className={styles.sampleMainCardPublishedOverlay} aria-hidden>
              {item.scrollFaceBadge?.trim() ? (
                <span className={publishedScrollBadgeClass(item.scrollFaceBadge.trim())}>
                  {item.scrollFaceBadge.trim()}
                </span>
              ) : null}
              <p
                className={styles.sampleMainCardPublishedOverlayTitle}
                style={{ color: titleColor, textShadow: overlayTextShadow }}
              >
                {item.title}
              </p>
              {metaLines.map((line, idx) => (
                <p
                  key={`${idx}-${line}`}
                  className={styles.sampleMainCardPublishedOverlayMeta}
                  style={{ color: metaColor, textShadow: overlayTextShadow }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : item.imageUrl?.trim() ? (
          <img
            src={item.imageUrl.trim()}
            alt=""
            className={styles.sampleMainCardPoster}
            decoding="async"
            loading={lcpHeroImage ? "eager" : "lazy"}
            {...(lcpHeroImage ? { fetchPriority: "high" as const } : {})}
          />
        ) : null}
        {!usePublishedScrollLayout ? (
          <div className={styles.sampleMainCardTitleOverlay}>{item.title}</div>
        ) : null}
        {item.external ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sampleMainCardShortcut}
            {...{ [SITE_SCROLL_SHORTCUT]: "" }}
            tabIndex={selected ? 0 : -1}
            aria-hidden={!selected}
            onPointerDown={(e) => e.stopPropagation()}
          >
            자세히 보기 ▶
          </a>
        ) : (
          <Link
            href={item.href}
            prefetch={false}
            className={styles.sampleMainCardShortcut}
            {...{ [SITE_SCROLL_SHORTCUT]: "" }}
            tabIndex={selected ? 0 : -1}
            aria-hidden={!selected}
            onPointerDown={(e) => e.stopPropagation()}
          >
            자세히 보기 ▶
          </Link>
        )}
      </div>
    </div>
  );
});

export type MainSiteScrollCardsProps = {
  items: MainSiteScrollCardItem[];
  slideCardMoveDurationSec: number;
};

export function MainSiteScrollCards({ items, slideCardMoveDurationSec }: MainSiteScrollCardsProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const lcpHeroItemIndex = useMemo(
    () =>
      items.findIndex(
        (x) =>
          Boolean(x.imageUrl?.trim()) ||
          Boolean(
            x.slideDeckItem &&
              (x.slideDeckItem.image320Url?.trim() ||
                (typeof x.slideDeckItem.mediaBackground === "string" && x.slideDeckItem.mediaBackground.trim())),
          ),
      ),
    [items],
  );

  const trackStyle = useMemo(
    () =>
      ({
        "--main-sample-slide-duration": `${slideCardMoveDurationSec}s`,
        animationPlayState: "running" as const,
      }) as CSSProperties,
    [slideCardMoveDurationSec],
  );

  const trackStylePaused = useMemo(
    () =>
      ({
        "--main-sample-slide-duration": `${slideCardMoveDurationSec}s`,
        animationPlayState: "paused" as const,
      }) as CSSProperties,
    [slideCardMoveDurationSec],
  );

  const onCardPointerDown = useCallback((itemId: string) => {
    setSelectedItemId((prev) => {
      if (prev === null) return itemId;
      if (prev === itemId) return null;
      return null;
    });
  }, []);

  const onViewportPointerDownCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (selectedItemId === null) return;
      const el = e.target as HTMLElement | null;
      if (!el || el.closest(`[${SITE_SCROLL_CARD}]`)) return;
      setSelectedItemId(null);
    },
    [selectedItemId],
  );

  if (items.length === 0) {
    return (
      <div className={styles.slideViewportSiteMain} data-no-root-swipe>
        <p className={styles.sampleMainEmpty}>등록된 메인 카드가 없습니다.</p>
      </div>
    );
  }

  const renderSegment = (segmentKey: string) => (
    <div
      className={`${styles.sampleMainMarqueeSegment} ${siteStyles.segmentNoShrink} ${siteStyles.segmentRelativeForDim}`}
      key={segmentKey}
    >
      <div
        className={`${siteStyles.marqueeDimLayer} ${selectedItemId ? siteStyles.marqueeDimLayerVisible : ""}`}
        aria-hidden
      />
      <div className={siteStyles.leadInSpacer} aria-hidden />
      {items.map((item, itemIndex) => {
        const rowKey = `${segmentKey}-${item.id}`;
        const lcpHeroImage =
          segmentKey === "a" && itemIndex === lcpHeroItemIndex && lcpHeroItemIndex >= 0;
        return (
          <MainSiteCardRow
            key={rowKey}
            rowKey={rowKey}
            item={item}
            selected={selectedItemId === item.id}
            onCardPointerDown={onCardPointerDown}
            lcpHeroImage={lcpHeroImage}
          />
        );
      })}
    </div>
  );

  const pauseMarquee = selectedItemId !== null;

  return (
    <div
      className={`${styles.slideViewportSiteMain} ${siteStyles.viewportMarquee}`}
      data-no-root-swipe
      onPointerDownCapture={onViewportPointerDownCapture}
    >
      <div
        className={`${styles.sampleMainMarqueeTrack} ${siteStyles.trackWillChange}`}
        style={pauseMarquee ? trackStylePaused : trackStyle}
      >
        {renderSegment("a")}
        {renderSegment("b")}
      </div>
    </div>
  );
}
