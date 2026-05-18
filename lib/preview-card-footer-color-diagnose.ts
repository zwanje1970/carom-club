"use client";

import type { CSSProperties } from "react";

const ENABLE_CARD_FOOTER_COLOR_DIAG = process.env.NODE_ENV !== "production";

export type CardFooterColorDiagPaletteState = {
  /** 편집기 팔레트에서 선택된 날짜 색( state ) */
  editorSelectedDateColor: string;
  /** 편집기 팔레트에서 선택된 장소 색( state ) */
  editorSelectedPlaceColor: string;
  /** SlideDeckItem 으로 전달된 날짜 색 */
  passedToCardDateColor: string;
  /** SlideDeckItem 으로 전달된 장소 색 */
  passedToCardPlaceColor: string;
};

function readFooterTextColorDiag(el: HTMLElement) {
  const computed = window.getComputedStyle(el);
  return {
    dataAttribute: el.dataset.tournamentCardOverlay ?? "",
    className: typeof el.className === "string" ? el.className : "",
    inlineStyleColor: el.style.color || "",
    computedStyleColor: computed.color,
    computedStyleOpacity: computed.opacity,
    computedStyleFilter: computed.filter === "none" ? "" : computed.filter,
    computedStyleMixBlendMode: computed.mixBlendMode === "normal" ? "" : computed.mixBlendMode,
    computedStyleVisibility: computed.visibility,
    computedStyleZIndex: computed.zIndex,
  };
}

/** 렌더 직전 splitDateStyle / splitPlaceStyle 비교 */
export function logCardColorDiagStyleObjects(
  dateStyle: CSSProperties | undefined,
  placeStyle: CSSProperties | undefined,
  raw: { footerDateColorRaw: string; footerPlaceColorRaw: string },
): void {
  if (!ENABLE_CARD_FOOTER_COLOR_DIAG) return;
  console.info("[card-color-diag:style-objects]", {
    dateStyleColor: dateStyle?.color ?? "(undefined)",
    splitPlaceStyleColor: placeStyle?.color ?? "(undefined)",
    dateStyleOpacity: dateStyle?.opacity ?? "(undefined)",
    splitPlaceStyleOpacity: placeStyle?.opacity ?? "(undefined)",
    dateStyleFilter: dateStyle?.filter ?? "(undefined)",
    splitPlaceStyleFilter: placeStyle?.filter ?? "(undefined)",
    footerDateColorRaw: raw.footerDateColorRaw || "(empty)",
    footerPlaceColorRaw: raw.footerPlaceColorRaw || "(empty)",
  });
}

export function logCardFooterColorDiagnosis(
  cardRoot: HTMLElement,
  palette: CardFooterColorDiagPaletteState,
): void {
  if (!ENABLE_CARD_FOOTER_COLOR_DIAG) return;

  const dateEl = cardRoot.querySelector<HTMLElement>('[data-tournament-card-overlay="date"]');
  const placeEl = cardRoot.querySelector<HTMLElement>('[data-tournament-card-overlay="place"]');

  if (dateEl) {
    console.info("[card-color-diag:date]", readFooterTextColorDiag(dateEl));
  } else {
    console.info("[card-color-diag:date]", { error: "date-element-missing" });
  }

  if (placeEl) {
    console.info("[card-color-diag:place]", readFooterTextColorDiag(placeEl));
  } else {
    console.info("[card-color-diag:place]", { error: "place-element-missing" });
  }

  console.info("[card-color-diag:palette-state]", {
    editorSelectedDateColor: palette.editorSelectedDateColor || "(empty)",
    editorSelectedPlaceColor: palette.editorSelectedPlaceColor || "(empty)",
    passedToCardDateColor: palette.passedToCardDateColor || "(empty)",
    passedToCardPlaceColor: palette.passedToCardPlaceColor || "(empty)",
    editorVsPassedDateMatch:
      palette.editorSelectedDateColor.trim().toLowerCase() ===
      palette.passedToCardDateColor.trim().toLowerCase(),
    editorVsPassedPlaceMatch:
      palette.editorSelectedPlaceColor.trim().toLowerCase() ===
      palette.passedToCardPlaceColor.trim().toLowerCase(),
  });

  const dateDiag = dateEl ? readFooterTextColorDiag(dateEl) : null;
  const placeDiag = placeEl ? readFooterTextColorDiag(placeEl) : null;

  let verdict = "inconclusive";
  let conclusion = "";

  if (!dateDiag || !placeDiag) {
    verdict = "inconclusive";
    conclusion = "date-or-place-element-missing";
  } else {
    const computedColorDifferent =
      dateDiag.computedStyleColor !== placeDiag.computedStyleColor;
    const inlineSame =
      Boolean(dateDiag.inlineStyleColor) &&
      dateDiag.inlineStyleColor === placeDiag.inlineStyleColor;
    const opacityOrFilterDifferent =
      dateDiag.computedStyleOpacity !== placeDiag.computedStyleOpacity ||
      dateDiag.computedStyleFilter !== placeDiag.computedStyleFilter ||
      dateDiag.computedStyleMixBlendMode !== placeDiag.computedStyleMixBlendMode;

    if (computedColorDifferent) {
      if (inlineSame) {
        verdict = "css-overwrite-or-parent-effect";
        conclusion =
          "inline color matches but computed color differs — CSS specificity or ancestor opacity/filter";
      } else {
        verdict = "final-color-different";
        if (!palette.passedToCardPlaceColor && palette.passedToCardDateColor) {
          conclusion =
            "palette-or-passed-value: place color not passed — CSS default .footerPlace (#3f3f46) may apply";
        } else if (dateDiag.inlineStyleColor && !placeDiag.inlineStyleColor) {
          conclusion = "style-object: place has no inline color — CSS .footerPlace default may apply";
        } else if (!dateDiag.inlineStyleColor && placeDiag.inlineStyleColor) {
          conclusion = "style-object: date has no inline color, place has inline color";
        } else {
          conclusion =
            "computed color differs — check CSS (.footerDate #18181b vs .footerPlace #3f3f46) or unequal style objects";
        }
      }
    } else if (opacityOrFilterDifferent) {
      verdict = "place-opacity-filter-effect";
      conclusion = "computed color matches but place opacity/filter/mix-blend differs from date";
    } else {
      verdict = "rendering-or-svg-layer-effect";
      conclusion =
        "computed color/opacity/filter match in DOM — if preview still looks different, visual may be CSS default before paint or capture/SVG path (not this preview pass)";
    }
  }

  console.info("[card-color-diag:verdict]", {
    verdict,
    conclusion,
    dateComputedColor: dateDiag?.computedStyleColor ?? null,
    placeComputedColor: placeDiag?.computedStyleColor ?? null,
    dateInlineColor: dateDiag?.inlineStyleColor ?? null,
    placeInlineColor: placeDiag?.inlineStyleColor ?? null,
  });
}
