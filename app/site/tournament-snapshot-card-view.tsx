"use client";

import type { ReactNode } from "react";
import { TournamentStatusBadge, type TournamentPostStatus } from "./tournament-slide-card-status-badge";
import styles from "./tournament-slide-card-previews.module.css";

export type { TournamentPostStatus };

export type SlideDeckItem = {
  snapshotId: string;
  title: string;
  subtitle: string;
  image320Url?: string;
  statusBadge?: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
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
}: {
  variant: SlidePreviewVariant;
  item: TournamentSlidePreviewItem;
  children: ReactNode;
  badge: ReactNode;
}) {
  const cssBg = item.mediaBackground?.trim();
  const imgUrl = item.image320Url?.trim();
  const overlayBlend = Boolean(imgUrl) && item.imageOverlayBlend !== false;
  const overlayOpacity = Math.min(1, Math.max(0.15, item.imageOverlayOpacity ?? 0.78));
  const paintClass = [styles.mediaPaint, variant === "frame" && !cssBg ? styles.mediaPaintFrameDefault : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.media}>
      <div className={paintClass} style={cssBg ? { background: cssBg } : undefined} aria-hidden />
      {imgUrl ? (
        <img
          className={styles.bg}
          style={overlayBlend ? { opacity: overlayOpacity } : { opacity: 1 }}
          src={imgUrl}
          alt={item.title || "카드 배경"}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <div className={styles.statusBadgeWrap}>{badge}</div>
      {children}
    </div>
  );
}

/** carom-postcard-template-test: TournamentSlideCardPreview.tsx (마크업 동일) */
function TournamentSlideCardPreview({
  item,
  variant,
}: {
  item: TournamentSlidePreviewItem;
  variant: SlidePreviewVariant;
}) {
  const status = toStatus(item.statusBadge);
  const parsed = parseSubtitle(item.subtitle);
  const lead = (item.cardExtraLine1 ?? "").trim();
  const description = (item.cardExtraLine2 ?? "").trim();
  const statusBadge = <TournamentStatusBadge status={status} />;

  if (variant === "classic") {
    return (
      <article className={styles.cardRoot}>
        <MediaStack variant="classic" item={item} badge={statusBadge}>
          <div className={styles.classicInner}>
            <div className={styles.classicTop}>
              <div className={styles.classicMain}>
                {lead ? <p className={styles.classicLead}>{lead}</p> : null}
                <h3 className={styles.classicTitle}>{item.title || "(제목)"}</h3>
                {description ? <p className={styles.classicDesc}>{description}</p> : null}
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
      <article className={styles.cardRoot}>
        <MediaStack variant="frame" item={item} badge={statusBadge}>
          <div className={styles.frameInner}>
            <div className={styles.frameCenter}>
              {lead ? <p className={styles.frameLead}>{lead}</p> : null}
              <h3 className={styles.frameTitle}>{item.title || "(제목)"}</h3>
              {description ? <p className={styles.frameDesc}>{description}</p> : null}
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

export function TournamentSnapshotCardView({ item }: { item: SlideDeckItem }) {
  const previewItem = slideDeckItemToPreviewItem(item);
  const variant: SlidePreviewVariant = item.cardTemplate === "B" ? "frame" : "classic";
  return <TournamentSlideCardPreview item={previewItem} variant={variant} />;
}

export function SlideDeckCard({ item }: { item: SlideDeckItem }) {
  return <TournamentSnapshotCardView item={item} />;
}
