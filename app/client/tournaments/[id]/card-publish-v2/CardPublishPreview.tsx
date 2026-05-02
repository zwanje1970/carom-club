"use client";

import { forwardRef, memo, useMemo } from "react";
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
  slideImageOverlayOpacity: number;
  slideLeadTextColor?: string;
  slideTitleTextColor?: string;
  slideDescTextColor?: string;
  slideTextShadowEnabled: boolean;
  slideSurfaceFull: boolean;
  slideFooterDateTextColor?: string;
  slideFooterPlaceTextColor?: string;
};

function slideItemFromModel(m: CardPublishPreviewModel): SlideDeckItem {
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
    imageOverlayBlend: true,
    imageOverlayOpacity: m.slideImageOverlayOpacity,
    ...(m.slideLeadTextColor ? { cardLeadTextColor: m.slideLeadTextColor } : {}),
    ...(m.slideTitleTextColor ? { cardTitleTextColor: m.slideTitleTextColor } : {}),
    ...(m.slideDescTextColor ? { cardDescriptionTextColor: m.slideDescTextColor } : {}),
    ...(m.slideTextShadowEnabled ? { cardTextShadowEnabled: true } : {}),
    ...(m.slideSurfaceFull ? { cardSurfaceLayout: "full" as const } : {}),
    ...(m.slideFooterDateTextColor ? { cardFooterDateTextColor: m.slideFooterDateTextColor } : {}),
    ...(m.slideFooterPlaceTextColor ? { cardFooterPlaceTextColor: m.slideFooterPlaceTextColor } : {}),
  };
}

const CardPublishPreviewInner = forwardRef<
  HTMLDivElement,
  { model: CardPublishPreviewModel; isImageCaptureMode?: boolean }
>(function CardPublishPreviewInner({ model, isImageCaptureMode = false }, ref) {
  const item = useMemo(() => slideItemFromModel(model), [model]);
  return (
    <div ref={ref} className={editorStyles.cardPublishCaptureRoot}>
      <TournamentSnapshotCardView
        item={item}
        slideDeck
        templateCardLayout
        editorCompactCardHeight
        slideDeckSolidBackdrop={SLIDE_DECK_SOLID_BACKDROPS[0]}
        isImageCaptureMode={isImageCaptureMode}
      />
    </div>
  );
});

CardPublishPreviewInner.displayName = "CardPublishPreviewInner";

export const CardPublishPreview = memo(CardPublishPreviewInner);
