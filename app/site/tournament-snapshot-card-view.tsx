"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { TournamentCardOverlaySnapshot } from "../../lib/site/tournament-card-overlay-snapshot";
import { TournamentStatusBadge, type TournamentPostStatus } from "./tournament-slide-card-status-badge";
import styles from "./tournament-slide-card-previews.module.css";

/* 편집기 미리보기·게시 PNG(html2canvas) 입력용 HTML 렌더 — /site 메인 세로 덱은 평면화된 게시 PNG 1장(`MainSiteScrollCards`)만 표시(글자·배지 HTML 레이어 없음). 둥근 모서리는 카드 컨테이너(border-radius+overflow)가 담당. 디자인 좌표 440×180 아트보드(`slideDeckAspectFill`). */

export type { TournamentPostStatus };

/** 분리형(하단 띠) / 전체형(배경 위 오버레이) — 미지정은 분리형 */
export type TournamentCardSurfaceLayout = "split" | "full";

export type SlideDeckItem = {
  /** 없거나 tournament면 대회 카드(기본) */
  type?: "tournament" | "ad";
  linkType?: "internal" | "external";
  /** type === "ad"일 때 집계용 id */
  mainSlideAdId?: string;
  /** 메인 세로 덱: 광고 지연 로드 시에도 `MainSiteScrollCardItem.id` 고정용(미설정 시 snapshotId+index) */
  mainSlideScrollStableId?: string;
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
  /** 제목 효과(제목만 적용) */
  cardTitleEffect?: "none" | "shadow" | "outline" | "shadow_outline";
  cardTitleOutlineColor?: "black" | "white";
  cardSurfaceLayout?: TournamentCardSurfaceLayout;
  /** 하단 날짜/장소 분리영역 배경색 */
  cardBottomBarColor?: string | null;
  /** 하단 분리영역 투명도 0~1 */
  cardBottomBarOpacity?: number | null;
  /** 배경 위 가독성 그라데이션 프리셋 */
  cardGradientPreset?: "none" | "top" | "left" | "top_left" | "soft";
  /** 그라데이션 강도 0~1 */
  cardGradientOpacity?: number | null;
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
  /** 게시 시 생성한 카드 본문 640 스냅샷 URL — 메인 스크롤 카드에서 우선 표시 */
  publishedCardImageUrl?: string;
  /** 게시 시 생성한 카드 본문 320 스냅샷 URL — 메인 스크롤 등 목록 표시용 */
  publishedCardImage320Url?: string;
  /** 게시 시 생성한 카드 본문 480 스냅샷 URL — 메인 스크롤 카드 우선 */
  publishedCardImage480Url?: string;
  /** true: PNG에 글자 미포함(배경만) — 메인에서 HTML 오버레이 */
  publishedCardImageBackgroundOnly?: boolean;
  /** 메인 HTML 오버레이: 게시 시점 좌표 스냅샷(있으면 메인은 템플릿 분기 없이 표시) */
  overlaySnapshot?: TournamentCardOverlaySnapshot | null;
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
  cardTitleEffect?: "none" | "shadow" | "outline" | "shadow_outline";
  cardTitleOutlineColor?: "black" | "white";
  cardSurfaceLayout?: TournamentCardSurfaceLayout;
  cardBottomBarColor?: string | null;
  cardBottomBarOpacity?: number | null;
  cardGradientPreset?: "none" | "top" | "left" | "top_left" | "soft";
  cardGradientOpacity?: number | null;
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
    cardTitleEffect: item.cardTitleEffect,
    cardTitleOutlineColor: item.cardTitleOutlineColor,
    cardSurfaceLayout: item.cardSurfaceLayout === "full" ? "full" : "split",
    cardBottomBarColor: item.cardBottomBarColor,
    cardBottomBarOpacity: item.cardBottomBarOpacity,
    cardGradientPreset: item.cardGradientPreset,
    cardGradientOpacity: item.cardGradientOpacity,
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
  if (badge === "진행중") return "진행중";
  if (badge.includes("마감임박") || (badge.includes("마감") && badge.includes("임박"))) return "마감임박";
  if (badge.includes("종료")) return "진행중";
  if (badge.includes("마감")) return "마감";
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
  isImageCaptureMode,
  forceHeroImageCrossOrigin,
}: {
  variant: SlidePreviewVariant;
  item: TournamentSlidePreviewItem;
  children: ReactNode;
  badge: ReactNode;
  repImageHighPriority?: boolean;
  /** 메인 슬라이드: 링크 배경 이미지 대신 단색(구분용) */
  slideDeckSolidBackdrop?: string;
  /** 메인 슬라이드 광고 카드 — 상태배지 슬롯에 우측 상단 AD 텍스트만 */
  mainSlideAd?: boolean;
  onRepImageLoad?: () => void;
  /** 게시 PNG 캡처: AD 마크 등 글자만 숨김 */
  isImageCaptureMode?: boolean;
  /** 편집 미리보기 등: 첫 페인트부터 CORS 가능한 히어로 이미지(캡처용) */
  forceHeroImageCrossOrigin?: boolean;
}) {
  const solidBackdrop = slideDeckSolidBackdrop?.trim();
  const cssBg = item.mediaBackground?.trim();
  const rawImg = item.image320Url?.trim();
  /** 슬라이드 단색은 '배경 이미지 없음'일 때만 이미지를 가린다 — 포스터 카드는 그대로 노출 */
  const imgUrl = rawImg || undefined;
  /** 배경 이미지 위 오버레이(투명도)는 사용자가 명시적으로 켠 경우에만 적용 */
  const overlayBlend = Boolean(imgUrl) && item.imageOverlayBlend === true;
  const overlayOpacity =
    overlayBlend && typeof item.imageOverlayOpacity === "number" && Number.isFinite(item.imageOverlayOpacity)
      ? Math.min(1, Math.max(0.15, item.imageOverlayOpacity))
      : 1;
  const paintBg = imgUrl ? (cssBg ? cssBg : undefined) : cssBg || solidBackdrop;
  const paintBackground =
    paintBg ?? (imgUrl ? "transparent" : solidBackdrop?.trim() ? solidBackdrop : "transparent");
  const paintStyle = { background: paintBackground } satisfies CSSProperties;
  const paintClass = styles.mediaPaint;

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
      <div className={paintClass} style={paintStyle} aria-hidden />
      {imgUrl ? (
        <img
          ref={repImageHighPriority ? heroImgRef : undefined}
          className={styles.bg}
          style={overlayBlend ? { opacity: overlayOpacity } : { opacity: 1 }}
          src={imgUrl}
          alt=""
          loading={repImageHighPriority ? "eager" : "lazy"}
          decoding="async"
          {...(isImageCaptureMode || forceHeroImageCrossOrigin ? { crossOrigin: "anonymous" as const } : {})}
          {...(repImageHighPriority ? { fetchPriority: "high" as const } : {})}
          onLoad={repImageHighPriority && onRepImageLoad ? fireRepImageLoad : undefined}
        />
      ) : null}
      <div
        className={styles.statusBadgeWrap}
        {...(!mainSlideAd
          ? {
              "data-tournament-card-overlay": "statusBadge",
              "data-status-badge-display": (item.statusBadge ?? "").trim(),
            }
          : {})}
      >
        {mainSlideAd ? (
          <span
            className={`${styles.adMark} ${isImageCaptureMode ? styles.imageCaptureHideGlyph : ""}`.trim()}
            aria-hidden
          >
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
  slideDeckAspectFill,
  templateCardLayout,
  repImageHighPriority,
  slideDeckSolidBackdrop,
  mainSlideAd,
  tournamentPublishedHeightScale = true,
  editorPreviewFixedLayout = false,
  artboardPx = false,
  onRepImageLoad,
  isImageCaptureMode = false,
  forceHeroImageCrossOrigin,
}: {
  item: TournamentSlidePreviewItem;
  variant: SlidePreviewVariant;
  /** 메인 슬라이드 창: 그림자를 창 안쪽으로만 두는 전용 스타일 */
  slideDeck?: boolean;
  /** /site 메인 세로 스크롤 덱: 면 aspect-ratio + flex 채움(가로 슬라이드는 미사용) */
  slideDeckAspectFill?: boolean;
  /** 템플릿 TournamentPostCard + SlideDeck 카드 규격(작성 미리보기·슬라이드 공통) */
  templateCardLayout?: boolean;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
  /** 메인 슬라이드 광고 카드 */
  mainSlideAd?: boolean;
  /** 대회·광고 슬라이드 카드 동일 높이 스케일 */
  tournamentPublishedHeightScale?: boolean;
  /** 게시카드 작성 미리보기만: 카드 박스·텍스트 슬롯 높이 고정(메인·다른 경로 false) */
  editorPreviewFixedLayout?: boolean;
  /** 440×180 고정 아트보드 — 게시 스냅샷·편집 미리보기(메인 면에서는 미사용) */
  artboardPx?: boolean;
  onRepImageLoad?: () => void;
  /** true: 제목·부가·푸터·배지 글자만 숨김(레이아웃 유지) — html2canvas PNG용 */
  isImageCaptureMode?: boolean;
  forceHeroImageCrossOrigin?: boolean;
}) {
  const status = toStatus(item.statusBadge);
  const parsed = parseSubtitle(item.subtitle);
  const lead = item.cardExtraLine1 ?? "";
  const description = item.cardExtraLine2 ?? "";
  const description2 = item.cardExtraLine3 ?? "";
  const leadColor = (item.cardLeadTextColor ?? "").trim();
  const titleColor = (item.cardTitleTextColor ?? "").trim();
  const descColor = (item.cardDescriptionTextColor ?? "").trim();
  const titleEffect = item.cardTitleEffect ?? "none";
  const titleOutlineColor = item.cardTitleOutlineColor === "white" ? "white" : "black";
  const useLayeredTitleOutline = titleEffect === "outline" || titleEffect === "shadow_outline";
  const statusBadge = <TournamentStatusBadge status={status} hideLabel={isImageCaptureMode} />;
  const captureHideGlyphClass = isImageCaptureMode ? styles.imageCaptureHideGlyph : "";
  const surfaceLayout: TournamentCardSurfaceLayout = "split";
  const footerDateColor = (item.cardFooterDateTextColor ?? "").trim();
  const footerPlaceColor = (item.cardFooterPlaceTextColor ?? "").trim();
  const bottomBarColor = (item.cardBottomBarColor ?? "").trim() || "#ffffff";
  const bottomBarOpacityRaw =
    typeof item.cardBottomBarOpacity === "number" && Number.isFinite(item.cardBottomBarOpacity)
      ? item.cardBottomBarOpacity
      : 1;
  const bottomBarOpacity = Math.min(1, Math.max(0, bottomBarOpacityRaw));
  const bottomBarStyle =
    bottomBarOpacity <= 0
      ? ({ background: "transparent" } as CSSProperties)
      : ({
          backgroundColor: bottomBarColor,
          opacity: bottomBarOpacity,
        } as CSSProperties);
  const gradientPreset = item.cardGradientPreset ?? "none";
  const gradientOpacityRaw =
    typeof item.cardGradientOpacity === "number" && Number.isFinite(item.cardGradientOpacity)
      ? item.cardGradientOpacity
      : 0;
  const gradientOpacity = Math.min(1, Math.max(0, gradientOpacityRaw));
  const gradientLayerClass =
    gradientPreset === "top"
      ? styles.mediaGradientTop
      : gradientPreset === "left"
        ? styles.mediaGradientLeft
        : gradientPreset === "top_left"
          ? styles.mediaGradientTopLeft
          : gradientPreset === "soft"
            ? styles.mediaGradientSoft
            : "";

  const rootClass = [
    styles.cardRoot,
    slideDeck ? styles.cardRootSlideDeck : "",
    slideDeck && slideDeckAspectFill ? styles.cardRootSlideDeckAspectFill : "",
    templateCardLayout ? styles.cardRootTemplateLayout : "",
    tournamentPublishedHeightScale ? styles.cardRootTournamentPublishedScale : "",
    item.cardTextShadowEnabled ? styles.cardTextShadowOn : "",
    titleEffect === "shadow" ? styles.cardTitleEffectShadow : "",
    titleEffect === "outline" ? styles.cardTitleEffectOutline : "",
    titleEffect === "outline" && titleOutlineColor === "white" ? styles.cardTitleEffectOutlineWhite : "",
    titleEffect === "shadow_outline" ? styles.cardTitleEffectShadowOutline : "",
    titleEffect === "shadow_outline" && titleOutlineColor === "white"
      ? styles.cardTitleEffectShadowOutlineWhite
      : "",
    mainSlideAd ? styles.cardRootMainSlideAd : "",
    artboardPx ? styles.cardRootArtboardPx : "",
  ]
    .filter(Boolean)
    .join(" ");

  const layoutStableSlots = editorPreviewFixedLayout || artboardPx;
  const leadText = lead.trim();
  const descText = description.trim();
  const desc2Text = description2.trim();
  const showLeadBlock = layoutStableSlots || leadText.length > 0;
  const showDescBlock = layoutStableSlots || descText.length > 0;
  const showDesc2Block = layoutStableSlots || desc2Text.length > 0;
  const leadDisplay = layoutStableSlots && !leadText ? "\u00a0" : lead;
  const descDisplay = layoutStableSlots && !descText ? "\u00a0" : description;
  const desc2Display = layoutStableSlots && !desc2Text ? "\u00a0" : description2;

  const splitDateStyle = footerDateColor ? { color: footerDateColor } : undefined;
  const splitPlaceStyle = footerPlaceColor ? { color: footerPlaceColor } : undefined;

  const splitFooter = (
    <footer className={styles.cardFooter}>
      <div className={styles.cardFooterBackground} style={bottomBarStyle} />
      <p
        data-tournament-card-overlay="date"
        className={`${styles.footerDate} ${captureHideGlyphClass}`.trim()}
        style={splitDateStyle}
      >
        {parsed.dateText}
      </p>
      <p
        data-tournament-card-overlay="place"
        className={`${styles.footerPlace} ${captureHideGlyphClass}`.trim()}
        style={splitPlaceStyle}
      >
        {parsed.placeText}
      </p>
    </footer>
  );

  if (variant === "classic") {
    return (
      <article
        className={rootClass}
        data-tournament-card-capture-root="1"
        data-editor-card-preview={editorPreviewFixedLayout && !artboardPx ? "1" : undefined}
      >
        <MediaStack
          variant="classic"
          item={item}
          badge={statusBadge}
          repImageHighPriority={repImageHighPriority}
          slideDeckSolidBackdrop={slideDeckSolidBackdrop}
          mainSlideAd={mainSlideAd}
          onRepImageLoad={onRepImageLoad}
          isImageCaptureMode={isImageCaptureMode}
          forceHeroImageCrossOrigin={forceHeroImageCrossOrigin}
        >
          {mainSlideAd ? (
            <div className={styles.adCardMediaFill} aria-hidden />
          ) : (
            <div className={styles.classicInner}>
              {gradientLayerClass && gradientOpacity > 0 ? (
                <div className={`${styles.mediaGradientLayer} ${gradientLayerClass}`} style={{ opacity: gradientOpacity }} />
              ) : null}
              <div className={styles.classicTop}>
                <div className={styles.classicMain}>
                  {showLeadBlock ? (
                    <p
                      data-tournament-card-overlay="lead"
                      className={`${styles.classicLead} ${captureHideGlyphClass}`.trim()}
                      style={leadColor ? { color: leadColor } : undefined}
                    >
                      {leadDisplay}
                    </p>
                  ) : null}
                  <h3
                    data-tournament-card-overlay="title"
                    className={`${styles.classicTitle} ${captureHideGlyphClass}`.trim()}
                    style={titleColor ? { color: titleColor } : undefined}
                  >
                    {useLayeredTitleOutline ? (
                      <span className={styles.titleLayerWrap}>
                        <span className={styles.titleLayerStroke} aria-hidden>
                          {item.title.length > 0 ? item.title : "(제목)"}
                        </span>
                        <span className={styles.titleLayerFill}>
                          {item.title.length > 0 ? item.title : "(제목)"}
                        </span>
                      </span>
                    ) : (
                      item.title.length > 0 ? item.title : "(제목)"
                    )}
                  </h3>
                  {showDescBlock ? (
                    <p
                      data-tournament-card-overlay="subtitle"
                      className={`${styles.classicDesc} ${captureHideGlyphClass}`.trim()}
                      style={descColor ? { color: descColor } : undefined}
                    >
                      {descDisplay}
                    </p>
                  ) : null}
                  {showDesc2Block ? (
                    <p
                      data-tournament-card-overlay="subtitle2"
                      className={`${styles.classicDescSecondary} ${captureHideGlyphClass}`.trim()}
                      style={descColor ? { color: descColor } : undefined}
                    >
                      {desc2Display}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </MediaStack>
        {mainSlideAd ? null : splitFooter}
      </article>
    );
  }

  if (variant === "frame") {
    return (
      <article
        className={rootClass}
        data-tournament-card-capture-root="1"
        data-editor-card-preview={editorPreviewFixedLayout && !artboardPx ? "1" : undefined}
      >
        <MediaStack
          variant="frame"
          item={item}
          badge={statusBadge}
          repImageHighPriority={repImageHighPriority}
          slideDeckSolidBackdrop={slideDeckSolidBackdrop}
          mainSlideAd={mainSlideAd}
          onRepImageLoad={onRepImageLoad}
          isImageCaptureMode={isImageCaptureMode}
          forceHeroImageCrossOrigin={forceHeroImageCrossOrigin}
        >
          {mainSlideAd ? (
            <div className={styles.adCardMediaFill} aria-hidden />
          ) : (
            <div className={styles.frameInner}>
              {gradientLayerClass && gradientOpacity > 0 ? (
                <div className={`${styles.mediaGradientLayer} ${gradientLayerClass}`} style={{ opacity: gradientOpacity }} />
              ) : null}
              <div className={styles.frameCenter}>
                {showLeadBlock ? (
                  <p
                    data-tournament-card-overlay="lead"
                    className={`${styles.frameLead} ${captureHideGlyphClass}`.trim()}
                    style={leadColor ? { color: leadColor } : undefined}
                  >
                    {leadDisplay}
                  </p>
                ) : null}
                <h3
                  data-tournament-card-overlay="title"
                  className={`${styles.frameTitle} ${captureHideGlyphClass}`.trim()}
                  style={titleColor ? { color: titleColor } : undefined}
                >
                  {useLayeredTitleOutline ? (
                    <span className={styles.titleLayerWrap}>
                      <span className={styles.titleLayerStroke} aria-hidden>
                        {item.title.length > 0 ? item.title : "(제목)"}
                      </span>
                      <span className={styles.titleLayerFill}>
                        {item.title.length > 0 ? item.title : "(제목)"}
                      </span>
                    </span>
                  ) : (
                    item.title.length > 0 ? item.title : "(제목)"
                  )}
                </h3>
                {showDescBlock ? (
                  <p
                    data-tournament-card-overlay="subtitle"
                    className={`${styles.frameDesc} ${captureHideGlyphClass}`.trim()}
                    style={descColor ? { color: descColor } : undefined}
                  >
                    {descDisplay}
                  </p>
                ) : null}
                {showDesc2Block ? (
                  <p
                    data-tournament-card-overlay="subtitle2"
                    className={`${styles.frameDescSecondary} ${captureHideGlyphClass}`.trim()}
                    style={descColor ? { color: descColor } : undefined}
                  >
                    {desc2Display}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </MediaStack>
        {mainSlideAd ? null : splitFooter}
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
  slideDeckAspectFill = false,
  templateCardLayout = false,
  editorPreviewFixedLayout = false,
  artboardPx = false,
  repImageHighPriority,
  slideDeckSolidBackdrop,
  onRepImageLoad,
  isImageCaptureMode = false,
  suppressLink = false,
  forceHeroImageCrossOrigin,
}: {
  item: SlideDeckItem;
  slideDeck?: boolean;
  /** 메인 세로 스크롤 덱 전용 — slideDeck 과 함께만 사용 */
  slideDeckAspectFill?: boolean;
  templateCardLayout?: boolean;
  /** 게시카드 작성 미리보기만 — 카드·텍스트 영역 크기 고정 */
  editorPreviewFixedLayout?: boolean;
  /** 440×180 고정 픽셀 아트보드 — 게시 캡처·편집 미리보기(메인 면 미사용) */
  artboardPx?: boolean;
  repImageHighPriority?: boolean;
  slideDeckSolidBackdrop?: string;
  onRepImageLoad?: () => void;
  /** true: 게시 PNG(html2canvas)용 — 글자만 숨김, 배경·레이아웃 유지 */
  isImageCaptureMode?: boolean;
  /** true: 내부 미리보기만 렌더(바깥에서 Link/a로 감쌀 때) */
  suppressLink?: boolean;
  /** 편집 미리보기: 히어로 배경 img에 crossOrigin(캡처 시 CORS) */
  forceHeroImageCrossOrigin?: boolean;
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
      slideDeckAspectFill={slideDeckAspectFill}
      templateCardLayout={templateCardLayout}
      repImageHighPriority={repImageHighPriority}
      slideDeckSolidBackdrop={slideDeckSolidBackdrop}
      mainSlideAd={item.type === "ad"}
      tournamentPublishedHeightScale={true}
      editorPreviewFixedLayout={editorPreviewFixedLayout}
      artboardPx={artboardPx}
      onRepImageLoad={onRepImageLoad}
      isImageCaptureMode={isImageCaptureMode}
      forceHeroImageCrossOrigin={forceHeroImageCrossOrigin}
    />
  );
  if (!href || suppressLink) return inner;
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
