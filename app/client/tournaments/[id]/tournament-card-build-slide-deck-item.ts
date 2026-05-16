import { buildTournamentPublishedCardSubtitle } from "../../../../lib/tournament-slide-card-subtitle";
import type { SlideDeckItem } from "../../../site/tournament-snapshot-card-view";

/** 게시 직전 서버 이미지 생성 입력 — 서버 PublishedCardSnapshot GET 과 동일 필드 묶음 */
export type TournamentCardPublishCaptureSource = {
  snapshotId?: string;
  title: string;
  subtitle?: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  cardExtraLine3?: string | null;
  image320Url?: string;
  tournamentCardTemplate?: "A" | "B";
  tournamentBackgroundType?: "image" | "theme";
  tournamentTheme?: "dark" | "light" | "natural";
  tournamentMediaBackground?: string | null;
  tournamentImageOverlayBlend?: boolean | null;
  tournamentImageOverlayOpacity?: number | null;
  tournamentCardDisplayDate?: string | null;
  tournamentCardDisplayLocation?: string | null;
  cardLeadTextColor?: string | null;
  cardTitleTextColor?: string | null;
  cardDescriptionTextColor?: string | null;
  cardTitleEffect?: "none" | "shadow" | "outline" | "shadow_outline";
  cardBottomBarColor?: string | null;
  cardBottomBarOpacity?: number | null;
  cardGradientPreset?: "none" | "top" | "left" | "top_left" | "soft";
  cardGradientOpacity?: number | null;
  tournamentCardTextShadowEnabled?: boolean;
  tournamentCardSurfaceLayout?: "split" | "full";
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
};

export function buildSlideDeckItemForTournamentCapture(args: {
  tournamentId: string;
  source: TournamentCardPublishCaptureSource;
  statusBadge: string;
  tournamentFallbackDate: string;
  tournamentFallbackLocation: string;
}): SlideDeckItem {
  const { tournamentId, source, statusBadge, tournamentFallbackDate, tournamentFallbackLocation } = args;
  const subtitle =
    (source.subtitle ?? "").trim() ||
    buildTournamentPublishedCardSubtitle({
      cardDisplayDate: source.tournamentCardDisplayDate ?? "",
      cardDisplayLocation: source.tournamentCardDisplayLocation ?? "",
      tournamentDate: tournamentFallbackDate,
      tournamentLocation: tournamentFallbackLocation,
    });

  return {
    type: "tournament",
    linkType: "internal",
    snapshotId: (source.snapshotId ?? "").trim() || "capture",
    title: source.title,
    subtitle,
    targetDetailUrl: `/site/tournaments/${tournamentId}`,
    statusBadge,
    cardExtraLine1: source.cardExtraLine1,
    cardExtraLine2: source.cardExtraLine2,
    cardExtraLine3: source.cardExtraLine3,
    image320Url: source.image320Url,
    cardTemplate: source.tournamentCardTemplate === "B" ? "B" : "A",
    backgroundType: source.tournamentBackgroundType === "theme" ? "theme" : "image",
    themeType:
      source.tournamentTheme === "light"
        ? "light"
        : source.tournamentTheme === "natural"
          ? "natural"
          : "dark",
    ...(typeof source.tournamentMediaBackground === "string"
      ? { mediaBackground: source.tournamentMediaBackground }
      : {}),
    ...(source.tournamentImageOverlayBlend === true ? { imageOverlayBlend: true } : {}),
    ...(typeof source.tournamentImageOverlayOpacity === "number"
      ? { imageOverlayOpacity: source.tournamentImageOverlayOpacity }
      : {}),
    ...(typeof source.cardLeadTextColor === "string" && source.cardLeadTextColor.trim()
      ? { cardLeadTextColor: source.cardLeadTextColor.trim() }
      : {}),
    ...(typeof source.cardTitleTextColor === "string" && source.cardTitleTextColor.trim()
      ? { cardTitleTextColor: source.cardTitleTextColor.trim() }
      : {}),
    ...(typeof source.cardDescriptionTextColor === "string" && source.cardDescriptionTextColor.trim()
      ? { cardDescriptionTextColor: source.cardDescriptionTextColor.trim() }
      : {}),
    ...(source.cardTitleEffect ? { cardTitleEffect: source.cardTitleEffect } : {}),
    ...(typeof source.cardBottomBarColor === "string" ? { cardBottomBarColor: source.cardBottomBarColor } : {}),
    ...(typeof source.cardBottomBarOpacity === "number" ? { cardBottomBarOpacity: source.cardBottomBarOpacity } : {}),
    ...(source.cardGradientPreset ? { cardGradientPreset: source.cardGradientPreset } : {}),
    ...(typeof source.cardGradientOpacity === "number" ? { cardGradientOpacity: source.cardGradientOpacity } : {}),
    ...(source.tournamentCardTextShadowEnabled === true ? { cardTextShadowEnabled: true } : {}),
    ...(source.tournamentCardSurfaceLayout === "full" ? { cardSurfaceLayout: "full" as const } : {}),
    ...(typeof source.cardFooterDateTextColor === "string" && source.cardFooterDateTextColor.trim()
      ? { cardFooterDateTextColor: source.cardFooterDateTextColor.trim() }
      : {}),
    ...(typeof source.cardFooterPlaceTextColor === "string" && source.cardFooterPlaceTextColor.trim()
      ? { cardFooterPlaceTextColor: source.cardFooterPlaceTextColor.trim() }
      : {}),
  };
}
