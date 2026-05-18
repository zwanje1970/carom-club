"use client";

import { forwardRef, memo, useLayoutEffect, useMemo } from "react";
import { logCardFooterColorDiagnosis } from "../../../../../lib/preview-card-footer-color-diagnose";
import { logPlaceLayerDiagnosis } from "./preview-place-layer-diagnose";
import {
  SLIDE_DECK_SOLID_BACKDROPS,
  TournamentSnapshotCardView,
  type SlideDeckItem,
} from "../../../../site/tournament-snapshot-card-view";
import editorStyles from "../card-publish-editor.module.css";

/** 미리보기용 — `SlideDeckItem`과 동일 값, 객체 참조만 `useMemo`로 안정화 */
export type CardPublishPreviewModel = {
  slideTitle: string;
  slideSubtitle: string;
  slideStatusBadge: string;
  slideExtra1: string | null;
  slideExtra2: string | null;
  slideImage320Url?: string;
  slideCardTemplate: "A" | "B";
  slideBackgroundType: "image" | "theme";
  slideThemeType: "dark" | "light" | "natural";
  slideMediaBackground: string;
  /** v2 미디어 오버레이 켜짐일 때만 true — 스냅샷 `imageOverlayBlend`와 동일 */
  slideImageOverlayBlend?: boolean;
  slideImageOverlayOpacity: number;
  slideLeadTextColor?: string;
  slideTitleTextColor?: string;
  slideDescTextColor?: string;
  slideTextShadowEnabled: boolean;
  slideTitleEffect?: "none" | "shadow" | "outline" | "shadow_outline";
  slideTitleOutlineColor?: "black" | "white";
  slideBottomBarColor?: string;
  slideBottomBarOpacity?: number;
  slideGradientPreset?: "none" | "top" | "left" | "top_left" | "soft";
  slideGradientOpacity?: number;
  slideSurfaceFull: boolean;
};

function slideItemFromModel(
  m: CardPublishPreviewModel,
  editorFooter: { date: string; place: string },
): SlideDeckItem {
  const dateTrim = typeof editorFooter.date === "string" ? editorFooter.date.trim() : "";
  const placeTrim = typeof editorFooter.place === "string" ? editorFooter.place.trim() : "";
  return {
    snapshotId: "card-publish-preview",
    title: m.slideTitle,
    subtitle: m.slideSubtitle,
    statusBadge: m.slideStatusBadge,
    cardExtraLine1: m.slideExtra1,
    cardExtraLine2: m.slideExtra2,
    cardExtraLine3: null,
    image320Url: m.slideImage320Url,
    cardTemplate: m.slideCardTemplate,
    backgroundType: m.slideBackgroundType,
    themeType: m.slideThemeType,
    mediaBackground: m.slideMediaBackground,
    imageOverlayBlend: m.slideImageOverlayBlend === true,
    imageOverlayOpacity: m.slideImageOverlayOpacity,
    ...(m.slideLeadTextColor ? { cardLeadTextColor: m.slideLeadTextColor } : {}),
    ...(m.slideTitleTextColor ? { cardTitleTextColor: m.slideTitleTextColor } : {}),
    ...(m.slideDescTextColor ? { cardDescriptionTextColor: m.slideDescTextColor } : {}),
    ...(m.slideTextShadowEnabled ? { cardTextShadowEnabled: true } : {}),
    ...(m.slideTitleEffect ? { cardTitleEffect: m.slideTitleEffect } : {}),
    ...(m.slideTitleOutlineColor ? { cardTitleOutlineColor: m.slideTitleOutlineColor } : {}),
    ...(m.slideBottomBarColor ? { cardBottomBarColor: m.slideBottomBarColor } : {}),
    ...(typeof m.slideBottomBarOpacity === "number" ? { cardBottomBarOpacity: m.slideBottomBarOpacity } : {}),
    ...(m.slideGradientPreset ? { cardGradientPreset: m.slideGradientPreset } : {}),
    ...(typeof m.slideGradientOpacity === "number" ? { cardGradientOpacity: m.slideGradientOpacity } : {}),
    ...(m.slideSurfaceFull ? { cardSurfaceLayout: "full" as const } : {}),
    ...(dateTrim ? { cardFooterDateTextColor: dateTrim } : {}),
    ...(placeTrim ? { cardFooterPlaceTextColor: placeTrim } : {}),
  };
}

const CardPublishPreviewInner = forwardRef<
  HTMLDivElement,
  {
    model: CardPublishPreviewModel;
    /** 편집기 state와 동일 소스 — 미리보기 푸터 날짜 글자색(항상 전달) */
    editorFooterDateTextColor: string;
    /** 편집기 state와 동일 소스 — 미리보기 푸터 장소 글자색(항상 전달) */
    editorFooterPlaceTextColor: string;
    isImageCaptureMode?: boolean;
  }
>(function CardPublishPreviewInner({
  model,
  editorFooterDateTextColor,
  editorFooterPlaceTextColor,
  isImageCaptureMode = false,
}, ref) {
  const item = useMemo(
    () =>
      slideItemFromModel(model, {
        date: editorFooterDateTextColor,
        place: editorFooterPlaceTextColor,
      }),
    [model, editorFooterDateTextColor, editorFooterPlaceTextColor],
  );

  useLayoutEffect(() => {
    const root = typeof ref === "function" ? null : ref?.current;
    if (!(root instanceof HTMLElement)) return;
    const id = requestAnimationFrame(() => {
      const cardRoot = root.querySelector('[data-tournament-card-capture-root="1"]');
      if (cardRoot instanceof HTMLElement) {
        logPlaceLayerDiagnosis(cardRoot, "preview");
        logCardFooterColorDiagnosis(cardRoot, {
          editorSelectedDateColor: editorFooterDateTextColor ?? "",
          editorSelectedPlaceColor: editorFooterPlaceTextColor ?? "",
          passedToCardDateColor: item.cardFooterDateTextColor ?? "",
          passedToCardPlaceColor: item.cardFooterPlaceTextColor ?? "",
        });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [ref, item, isImageCaptureMode, editorFooterDateTextColor, editorFooterPlaceTextColor]);

  return (
    <div
      ref={ref}
      data-card-publish-artboard="1"
      data-tournament-card-publish-preview-root="1"
      className={`${editorStyles.cardPublishCaptureRoot} ${editorStyles.cardPublishCaptureRootFlexFill}`}
    >
      <TournamentSnapshotCardView
        item={item}
        slideDeck
        slideDeckAspectFill
        templateCardLayout
        editorPreviewFixedLayout
        suppressLink
        repImageHighPriority={Boolean(model.slideImage320Url?.trim())}
        slideDeckSolidBackdrop={SLIDE_DECK_SOLID_BACKDROPS[0]}
        isImageCaptureMode={isImageCaptureMode}
      />
    </div>
  );
});

CardPublishPreviewInner.displayName = "CardPublishPreviewInner";

export const CardPublishPreview = memo(CardPublishPreviewInner);
