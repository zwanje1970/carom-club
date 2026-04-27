"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { TournamentStatusBadge, type TournamentPostStatus } from "./tournament-slide-card-status-badge";
import styles from "./tournament-slide-card-previews.module.css";

export type { TournamentPostStatus };

export type SlideDeckItem = {
  /** 없거나 tournament면 대회 카드(기본) */
  type?: "tournament" | "ad";
  linkType?: "internal" | "external";
  /** type === "ad"일 때 집계용 id */
  mainSlideAdId?: string;
  snapshotId: string;
  title: string;
  subtitle: string;
  /** 메인 슬라이드 등: 클릭 시 이동할 상세 경로(없으면 링크 없음·미리보기 전용) */
  targetDetailUrl?: string;
  image320Url?: string;
  statusBadge?: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  /** 템플릿 TournamentPostCard descriptionText2 에 대응 */
  cardExtraLine3?: string | null;
  cardTemplate?: "A" | "B";
  backgroundType?: "image" | "theme";
  themeType?: "dark" | "light" | "natural";
  mediaBackground?: string;
  imageOverlayBlend?: boolean;
  imageOverlayOpacity?: number;
};

/** carom-postcard-template-test: TournamentSlideCardPreview.tsx TournamentSlidePreviewItem */
type TournamentSlidePreviewItem = {
  title: string;
  subtitle: string;
  statusBadge?: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  cardExtraLine3?: string | null;
  image320Url?: string;
  mediaBackground?: string;
  imageOverlayBlend?: boolean;
  imageOverlayOpacity?: number;
};

type SlidePreviewVariant = "classic" | "frame";

function slideDeckItemToPreviewItem(item: SlideDeckItem): TournamentSlidePreviewItem {
  const useBgImage = item.backgroundType !== "theme" && Boolean(item.image320Url?.trim());
  return {
    title: item.title,
    subtitle: item.subtitle,
    statusBadge: item.statusBadge,
    cardExtraLine1: item.cardExtraLine1,
    cardExtraLine2: item.cardExtraLine2,
    cardExtraLine3: item.cardExtraLine3,
    image320Url: useBgImage ? item.image320Url!.trim() : undefined,
    mediaBackground: item.mediaBackground,
    imageOverlayBlend: item.imageOverlayBlend,
    imageOverlayOpacity: item.imageOverlayOpacity,
  };
}

function parseSubtitle(subtitle: string): { dateText: string; placeText: string } {
  const parts = subtitle
    .split("·")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (parts.length === 0) return { dateText: "-", placeText: "-" };
  if (parts.length === 1) return { dateText: parts[0], placeText: "-" };
  return { dateText: parts[0], placeText: parts.slice(1).join(" · ") };
}

function toStatus(value: string | undefined): TournamentPostStatus {
  const badge = (value ?? "").trim();
  if (badge.includes("마감임박") || (badge.includes("마감") && badge.includes("임박"))) return "마감임박";
  if (badge.includes("대기")) return "대기자모집";
  if (badge.includes("종료")) return "종료";
  if (badge.includes("마감")) return "마감";
  if (badge.includes("진행")) return "모집중";
  return "모집중";
}

function MediaStack({
  variant,
  item,
  children,
  badge,
  repImageHighPriority,
  slideDeckSolidBackdrop,
  showAdBadge,
}: {
  variant: SlidePreviewVariant;
  item: TournamentSlidePreviewItem;
  children: ReactNode;
  badge: ReactNode;
  repImageHighPriority?: boolean;
  /** 메인 슬라이드: 링크 배경 이미지 대신 단색(구분용) */
  slideDeckSolidBackdrop?: string;
  /** type === "ad" 인 슬라이드 카드에만 AD 표시 */
  showAdBadge?: boolean;
}) {
  const solid = slideDeckSolidBackdrop?.trim();
  const cssBg = item.mediaBackground?.trim();
  const imgUrl = solid ? undefined : item.image320Url?.trim();
  const overlayBlend = Boolean(imgUrl) && item.imageOverlayBlend !== false;
  const overlayOpacity = Math.min(1, Math.max(0.15, item.imageOverlayOpacity ?? 0.78));
  const paintBg = solid ?? cssBg;
  const paintClass = [
    styles.mediaPaint,
    variant === "frame" && !paintBg ? styles.mediaPaintFrameDefault : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.media}>
      <div className={paintClass} style={paintBg ? { background: paintBg } : undefined} aria-hidden />
      {imgUrl ? (
        <img
          className={styles.bg}
          style={overlayBlend ? { opacity: overlayOpacity } : { opacity: 1 }}
          src={imgUrl}
          alt={item.title || "카드 배경"}
          loading={repImageHighPriority ? "eager" : "lazy"}
          decoding="async"
          {...(repImageHighPriority ? { fetchPriority: "high" as const } : {})}
        />
      ) : null}
      <div className={styles.statusBadgeWrap}>{badge}</div>
      {showAdBadge ? (
        <span className={styles.mainSlideAdBadge} aria-hidden>
          AD
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** carom-postcard-template-test: TournamentSlideCardPreview.tsx (마크업 동일) */
function TournamentSlideCardPreview({
  item,
  variant,
  slideDeck,
  templateCardLayout,
  repImageHighPriority,
  slideDeckSolidBackdrop,
  showAdBadge,
}: {
  item: TournamentSlidePreviewItem;
  variant: SlidePreviewVariant;
  /** 메인 슬라이드 창: 그림자를 창 안쪽으로만 두는 전용 스타일 */
  slideDeck?: boolean;
  /** 템플릿 TournamentPostCard + SlideDeck 카드 규격(작성 미리보기·슬라이드 공통) */
  templateCardLayout?: boolean;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
  /** SlideDeckItem.type === "ad" 일 때만 true */
  showAdBadge?: boolean;
}) {
  const status = toStatus(item.statusBadge);
  const parsed = parseSubtitle(item.subtitle);
  const lead = (item.cardExtraLine1 ?? "").trim();
  const description = (item.cardExtraLine2 ?? "").trim();
  const description2 = (item.cardExtraLine3 ?? "").trim();
  const statusBadge = <TournamentStatusBadge status={status} />;

  const rootClass = [
    styles.cardRoot,
    slideDeck ? styles.cardRootSlideDeck : "",
    templateCardLayout ? styles.cardRootTemplateLayout : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "classic") {
    return (
      <article className={rootClass}>
        <MediaStack
          variant="classic"
          item={item}
          badge={statusBadge}
          repImageHighPriority={repImageHighPriority}
          slideDeckSolidBackdrop={slideDeckSolidBackdrop}
          showAdBadge={showAdBadge}
        >
          <div className={styles.classicInner}>
            <div className={styles.classicTop}>
              <div className={styles.classicMain}>
                {lead ? <p className={styles.classicLead}>{lead}</p> : null}
                <h3 className={styles.classicTitle}>{item.title || "(제목)"}</h3>
                {description ? <p className={styles.classicDesc}>{description}</p> : null}
                {description2 ? <p className={styles.classicDescSecondary}>{description2}</p> : null}
              </div>
            </div>
          </div>
        </MediaStack>
        <footer className={styles.cardFooter}>
          <p className={styles.footerDate}>{parsed.dateText}</p>
          <p className={styles.footerPlace}>{parsed.placeText}</p>
        </footer>
      </article>
    );
  }

  if (variant === "frame") {
    return (
      <article className={rootClass}>
        <MediaStack
          variant="frame"
          item={item}
          badge={statusBadge}
          repImageHighPriority={repImageHighPriority}
          slideDeckSolidBackdrop={slideDeckSolidBackdrop}
          showAdBadge={showAdBadge}
        >
          <div className={styles.frameInner}>
            <div className={styles.frameCenter}>
              {lead ? <p className={styles.frameLead}>{lead}</p> : null}
              <h3 className={styles.frameTitle}>{item.title || "(제목)"}</h3>
              {description ? <p className={styles.frameDesc}>{description}</p> : null}
              {description2 ? <p className={styles.frameDescSecondary}>{description2}</p> : null}
            </div>
          </div>
        </MediaStack>
        <footer className={styles.cardFooter}>
          <p className={styles.footerDate}>{parsed.dateText}</p>
          <p className={styles.footerPlace}>{parsed.placeText}</p>
        </footer>
      </article>
    );
  }

  const _exhaustive: never = variant;
  return _exhaustive;
}

export function reportMainSlideAdMetric(adId: string, metric: "impressions" | "clicks"): void {
  void fetch("/api/site/main-slide-ad-metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adId, metric }),
    keepalive: metric === "clicks",
  }).catch(() => {});
}

export function TournamentSnapshotCardView({
  item,
  slideDeck = false,
  templateCardLayout = false,
  repImageHighPriority,
  slideDeckSolidBackdrop,
}: {
  item: SlideDeckItem;
  slideDeck?: boolean;
  templateCardLayout?: boolean;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
}) {
  const previewItem = slideDeckItemToPreviewItem(item);
  const variant: SlidePreviewVariant = item.cardTemplate === "B" ? "frame" : "classic";
  const href = (item.targetDetailUrl ?? "").trim();
  const isExternal = item.type === "ad" || item.linkType === "external" || /^https?:\/\//i.test(href);
  const inner = (
    <TournamentSlideCardPreview
      item={previewItem}
      variant={variant}
      slideDeck={slideDeck}
      templateCardLayout={templateCardLayout}
      repImageHighPriority={repImageHighPriority}
      slideDeckSolidBackdrop={slideDeckSolidBackdrop}
      showAdBadge={item.type === "ad"}
    />
  );
  if (!href) return inner;
  if (isExternal) {
    const adId = item.mainSlideAdId?.trim() ?? "";
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-main-slide-external="1"
        aria-label={item.title?.trim() ? `${item.title.trim()} 바로가기` : "광고 바로가기"}
        onClick={() => {
          if (adId) reportMainSlideAdMetric(adId, "clicks");
        }}
        style={{
          display: "block",
          width: "100%",
          maxWidth: "100%",
          textDecoration: "none",
          color: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={href}
      aria-label={item.title?.trim() ? `${item.title.trim()} 상세 보기` : "대회 상세 보기"}
      style={{
        display: "block",
        width: "100%",
        maxWidth: "100%",
        textDecoration: "none",
        color: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {inner}
    </Link>
  );
}

/** 메인 슬라이드 카드 구분용 배경(이미지 없음) — 색상만으로 5슬롯 구분 */
export const SLIDE_DECK_SOLID_BACKDROPS = [
  "#1a4d6e",
  "#6b2d42",
  "#0d5c45",
  "#4a3482",
  "#6b4a12",
] as const;

export function SlideDeckCard({
  item,
  repImageHighPriority,
  slideDeckSolidBackdrop,
}: {
  item: SlideDeckItem;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
}) {
  return (
    <TournamentSnapshotCardView
      item={item}
      slideDeck
      templateCardLayout
      repImageHighPriority={repImageHighPriority}
      slideDeckSolidBackdrop={slideDeckSolidBackdrop}
    />
  );
}
