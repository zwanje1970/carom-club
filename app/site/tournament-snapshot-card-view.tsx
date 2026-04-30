"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { TournamentStatusBadge, type TournamentPostStatus } from "./tournament-slide-card-status-badge";
import styles from "./tournament-slide-card-previews.module.css";

export type { TournamentPostStatus };

/** 분리형(하단 띠) / 전체형(배경 위 오버레이) — 미지정은 분리형 */
export type TournamentCardSurfaceLayout = "split" | "full";

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
  /** 비우면 테마 기본 글자색 */
  cardLeadTextColor?: string | null;
  cardTitleTextColor?: string | null;
  cardDescriptionTextColor?: string | null;
  cardTextShadowEnabled?: boolean;
  cardSurfaceLayout?: TournamentCardSurfaceLayout;
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
  /** 게시 시 생성한 카드 본문 640 스냅샷 URL — 메인 스크롤 카드에서 우선 표시 */
  publishedCardImageUrl?: string;
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
  cardLeadTextColor?: string | null;
  cardTitleTextColor?: string | null;
  cardDescriptionTextColor?: string | null;
  cardTextShadowEnabled?: boolean;
  cardSurfaceLayout?: TournamentCardSurfaceLayout;
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
};

type SlidePreviewVariant = "classic" | "frame";

function slideDeckItemToPreviewItem(item: SlideDeckItem): TournamentSlidePreviewItem {
  const isAd = item.type === "ad";
  const useBgImage = isAd
    ? Boolean(item.image320Url?.trim())
    : item.backgroundType !== "theme" && Boolean(item.image320Url?.trim());
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
    cardLeadTextColor: item.cardLeadTextColor,
    cardTitleTextColor: item.cardTitleTextColor,
    cardDescriptionTextColor: item.cardDescriptionTextColor,
    cardTextShadowEnabled: item.cardTextShadowEnabled,
    cardSurfaceLayout: item.cardSurfaceLayout === "full" ? "full" : "split",
    cardFooterDateTextColor: item.cardFooterDateTextColor,
    cardFooterPlaceTextColor: item.cardFooterPlaceTextColor,
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
  mainSlideAd,
  onRepImageLoad,
}: {
  variant: SlidePreviewVariant;
  item: TournamentSlidePreviewItem;
  children: ReactNode;
  badge: ReactNode;
  repImageHighPriority?: boolean;
  /** 메인 슬라이드: 링크 배경 이미지 대신 단색(구분용) */
  slideDeckSolidBackdrop?: string;
  /** 메인 슬라이드 광고 카드 — 텍스트 없음·상태배지 대신 AD 문자만 */
  mainSlideAd?: boolean;
  onRepImageLoad?: () => void;
}) {
  const solidBackdrop = slideDeckSolidBackdrop?.trim();
  const cssBg = item.mediaBackground?.trim();
  const rawImg = item.image320Url?.trim();
  /** 슬라이드 단색은 '배경 이미지 없음'일 때만 이미지를 가린다 — 포스터 카드는 그대로 노출 */
  const imgUrl = rawImg || undefined;
  const overlayBlend = Boolean(imgUrl) && item.imageOverlayBlend !== false;
  const overlayOpacity = Math.min(1, Math.max(0.15, item.imageOverlayOpacity ?? 1));
  const paintBg = imgUrl ? cssBg || undefined : cssBg || solidBackdrop;
  const paintClass = [
    styles.mediaPaint,
    variant === "frame" && !paintBg ? styles.mediaPaintFrameDefault : "",
  ]
    .filter(Boolean)
    .join(" ");

  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const repLoadFiredRef = useRef(false);
  const fireRepImageLoad = useCallback(() => {
    if (!onRepImageLoad || !repImageHighPriority) return;
    if (repLoadFiredRef.current) return;
    repLoadFiredRef.current = true;
    onRepImageLoad();
  }, [onRepImageLoad, repImageHighPriority]);

  useLayoutEffect(() => {
    repLoadFiredRef.current = false;
    if (!repImageHighPriority || !imgUrl || !onRepImageLoad) return;
    const id = requestAnimationFrame(() => {
      const el = heroImgRef.current;
      if (el?.complete) fireRepImageLoad();
    });
    return () => cancelAnimationFrame(id);
  }, [repImageHighPriority, imgUrl, onRepImageLoad, fireRepImageLoad]);

  return (
    <div className={styles.media}>
      <div className={paintClass} style={paintBg ? { background: paintBg } : undefined} aria-hidden />
      {imgUrl ? (
        <img
          ref={repImageHighPriority ? heroImgRef : undefined}
          className={styles.bg}
          style={overlayBlend ? { opacity: overlayOpacity } : { opacity: 1 }}
          src={imgUrl}
          alt={item.title || "카드 배경"}
          loading={repImageHighPriority ? "eager" : "lazy"}
          decoding="async"
          {...(repImageHighPriority ? { fetchPriority: "high" as const } : {})}
          onLoad={repImageHighPriority && onRepImageLoad ? fireRepImageLoad : undefined}
        />
      ) : null}
      <div className={styles.statusBadgeWrap}>
        {mainSlideAd ? (
          <span className={styles.adMark} aria-hidden>
            AD
          </span>
        ) : (
          badge
        )}
      </div>
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
  mainSlideAd,
  tournamentPublishedHeightScale = true,
  editorCompactCardHeight = false,
  onRepImageLoad,
}: {
  item: TournamentSlidePreviewItem;
  variant: SlidePreviewVariant;
  /** 메인 슬라이드 창: 그림자를 창 안쪽으로만 두는 전용 스타일 */
  slideDeck?: boolean;
  /** 템플릿 TournamentPostCard + SlideDeck 카드 규격(작성 미리보기·슬라이드 공통) */
  templateCardLayout?: boolean;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
  /** 메인 슬라이드 광고 카드 */
  mainSlideAd?: boolean;
  /** 대회·광고 슬라이드 카드 동일 높이 스케일 */
  tournamentPublishedHeightScale?: boolean;
  /** 게시카드 작성 미리보기·PNG 캡처: 카드 높이만 약 20% 축소(메인 live 미적용) */
  editorCompactCardHeight?: boolean;
  onRepImageLoad?: () => void;
}) {
  const status = toStatus(item.statusBadge);
  const parsed = parseSubtitle(item.subtitle);
  const lead = item.cardExtraLine1 ?? "";
  const description = item.cardExtraLine2 ?? "";
  const description2 = item.cardExtraLine3 ?? "";
  const leadColor = (item.cardLeadTextColor ?? "").trim();
  const titleColor = (item.cardTitleTextColor ?? "").trim();
  const descColor = (item.cardDescriptionTextColor ?? "").trim();
  const statusBadge = <TournamentStatusBadge status={status} />;
  const surfaceLayout: TournamentCardSurfaceLayout =
    item.cardSurfaceLayout === "full" ? "full" : "split";
  const footerDateColor = (item.cardFooterDateTextColor ?? "").trim();
  const footerPlaceColor = (item.cardFooterPlaceTextColor ?? "").trim();
  const fullFooterDateStyle = footerDateColor ? { color: footerDateColor } : undefined;
  const fullFooterPlaceStyle = footerPlaceColor ? { color: footerPlaceColor } : undefined;

  const rootClass = [
    styles.cardRoot,
    slideDeck ? styles.cardRootSlideDeck : "",
    templateCardLayout ? styles.cardRootTemplateLayout : "",
    tournamentPublishedHeightScale ? styles.cardRootTournamentPublishedScale : "",
    editorCompactCardHeight && tournamentPublishedHeightScale ? styles.cardRootEditorCompactHeight : "",
    item.cardTextShadowEnabled ? styles.cardTextShadowOn : "",
    surfaceLayout === "full" ? styles.cardRootSurfaceFull : "",
    mainSlideAd ? styles.cardRootMainSlideAd : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fullOverlayFooter = (
    <div className={styles.fullSurfaceFooter}>
      <p className={styles.fullSurfaceFooterDate} style={fullFooterDateStyle}>
        {parsed.dateText}
      </p>
      <p className={styles.fullSurfaceFooterPlace} style={fullFooterPlaceStyle}>
        {parsed.placeText}
      </p>
    </div>
  );

  const splitDateStyle = footerDateColor ? { color: footerDateColor } : undefined;
  const splitPlaceStyle = footerPlaceColor ? { color: footerPlaceColor } : undefined;

  const splitFooter = (
    <footer className={styles.cardFooter}>
      <p className={styles.footerDate} style={splitDateStyle}>
        {parsed.dateText}
      </p>
      <p className={styles.footerPlace} style={splitPlaceStyle}>
        {parsed.placeText}
      </p>
    </footer>
  );

  if (variant === "classic") {
    return (
      <article className={rootClass}>
        <MediaStack
          variant="classic"
          item={item}
          badge={statusBadge}
          repImageHighPriority={repImageHighPriority}
          slideDeckSolidBackdrop={slideDeckSolidBackdrop}
          mainSlideAd={mainSlideAd}
          onRepImageLoad={onRepImageLoad}
        >
          {mainSlideAd ? (
            <div className={styles.adCardMediaFill} aria-hidden />
          ) : (
            <div className={styles.classicInner}>
              <div className={styles.classicTop}>
                <div className={styles.classicMain}>
                  {lead.length > 0 ? (
                    <p className={styles.classicLead} style={leadColor ? { color: leadColor } : undefined}>
                      {lead}
                    </p>
                  ) : null}
                  <h3
                    className={styles.classicTitle}
                    style={titleColor ? { color: titleColor } : undefined}
                  >
                    {item.title.length > 0 ? item.title : "(제목)"}
                  </h3>
                  {description.length > 0 ? (
                    <p className={styles.classicDesc} style={descColor ? { color: descColor } : undefined}>
                      {description}
                    </p>
                  ) : null}
                  {description2.length > 0 ? (
                    <p
                      className={styles.classicDescSecondary}
                      style={descColor ? { color: descColor } : undefined}
                    >
                      {description2}
                    </p>
                  ) : null}
                </div>
              </div>
              {surfaceLayout === "full" ? fullOverlayFooter : null}
            </div>
          )}
        </MediaStack>
        {mainSlideAd ? null : surfaceLayout === "split" ? splitFooter : null}
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
          mainSlideAd={mainSlideAd}
          onRepImageLoad={onRepImageLoad}
        >
          {mainSlideAd ? (
            <div className={styles.adCardMediaFill} aria-hidden />
          ) : (
            <div className={styles.frameInner}>
              <div className={styles.frameCenter}>
                {lead.length > 0 ? (
                  <p className={styles.frameLead} style={leadColor ? { color: leadColor } : undefined}>
                    {lead}
                  </p>
                ) : null}
                <h3 className={styles.frameTitle} style={titleColor ? { color: titleColor } : undefined}>
                  {item.title.length > 0 ? item.title : "(제목)"}
                </h3>
                {description.length > 0 ? (
                  <p className={styles.frameDesc} style={descColor ? { color: descColor } : undefined}>
                    {description}
                  </p>
                ) : null}
                {description2.length > 0 ? (
                  <p
                    className={styles.frameDescSecondary}
                    style={descColor ? { color: descColor } : undefined}
                  >
                    {description2}
                  </p>
                ) : null}
                {surfaceLayout === "full" ? fullOverlayFooter : null}
              </div>
            </div>
          )}
        </MediaStack>
        {mainSlideAd ? null : surfaceLayout === "split" ? splitFooter : null}
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
  editorCompactCardHeight = false,
  repImageHighPriority,
  slideDeckSolidBackdrop,
  onRepImageLoad,
}: {
  item: SlideDeckItem;
  slideDeck?: boolean;
  templateCardLayout?: boolean;
  /** 작성 화면 미리보기·PNG 캡처만 — 메인 슬라이드(live)에서는 false 유지 */
  editorCompactCardHeight?: boolean;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
  onRepImageLoad?: () => void;
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
      mainSlideAd={item.type === "ad"}
      tournamentPublishedHeightScale={true}
      editorCompactCardHeight={editorCompactCardHeight}
      onRepImageLoad={onRepImageLoad}
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
  onRepImageLoad,
}: {
  item: SlideDeckItem;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
  onRepImageLoad?: () => void;
}) {
  return (
    <TournamentSnapshotCardView
      item={item}
      slideDeck
      templateCardLayout
      repImageHighPriority={repImageHighPriority}
      slideDeckSolidBackdrop={slideDeckSolidBackdrop}
      onRepImageLoad={onRepImageLoad}
    />
  );
}
