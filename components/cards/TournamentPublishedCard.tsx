"use client";

import type { PlatformCardTemplateStylePolicy } from "@/lib/platform-card-templates";

export type TournamentPublishedCardViewModel = {
  templateType: "basic" | "highlight";
  thumbnailUrl: string;
  cardTitle: string;
  displayDateText: string;
  displayRegionText: string;
  statusText: string;
  buttonText: string;
  shortDescription?: string;
};

function textAlignClass(value: PlatformCardTemplateStylePolicy["titleAlign"]): string {
  if (value === "center") return "text-center items-center";
  if (value === "right") return "text-right items-end";
  return "text-left items-start";
}

function statusAlignClass(value: PlatformCardTemplateStylePolicy["statusAlign"]): string {
  if (value === "center") return "text-center";
  if (value === "right") return "text-right";
  return "text-left";
}

function textPositionClass(value: PlatformCardTemplateStylePolicy["titlePosition"]): string {
  if (value === "center") return "justify-center";
  if (value === "bottom") return "justify-end";
  return "justify-start";
}

function descriptionPositionClass(
  value: PlatformCardTemplateStylePolicy["shortDescriptionPosition"]
): string {
  if (value === "center") return "justify-center";
  if (value === "bottom") return "justify-end";
  return "justify-start";
}

export function BasicCard({
  data,
  compact = false,
  stylePolicy,
  showDetailButton = false,
}: {
  data: TournamentPublishedCardViewModel;
  compact?: boolean;
  stylePolicy?: PlatformCardTemplateStylePolicy;
  showDetailButton?: boolean;
}) {
  const compactMobileWidthPx = compact && stylePolicy ? "46vw" : null;
  const responsiveCardWidth = stylePolicy
    ? compactMobileWidthPx
      ? `min(${stylePolicy.cardWidth}px, ${compactMobileWidthPx})`
      : `${stylePolicy.cardWidth}px`
    : undefined;
  const responsiveCardHeight = stylePolicy
    ? compactMobileWidthPx
      ? `min(${stylePolicy.cardHeight}px, calc(${compactMobileWidthPx} * ${stylePolicy.cardHeight / Math.max(1, stylePolicy.cardWidth)}))`
      : `${stylePolicy.cardHeight}px`
    : undefined;
  const imageAreaHeight = stylePolicy
    ? Math.max(0, Math.min(stylePolicy.imageAreaHeight, stylePolicy.cardHeight))
    : undefined;
  const responsiveImageAreaHeight =
    stylePolicy && imageAreaHeight != null
      ? compactMobileWidthPx
        ? `min(${imageAreaHeight}px, calc(${compactMobileWidthPx} * ${imageAreaHeight / Math.max(1, stylePolicy.cardWidth)}))`
        : `${imageAreaHeight}px`
      : undefined;
  const textPadding = stylePolicy
    ? {
        paddingTop: `${stylePolicy.paddingTop}px`,
        paddingBottom: `${stylePolicy.paddingBottom}px`,
        paddingLeft: `${stylePolicy.paddingLeft}px`,
        paddingRight: `${stylePolicy.paddingRight}px`,
        rowGap: `${stylePolicy.gapBetweenElements}px`,
      }
    : null;
  const titleBlock = (
    <h3
      className="line-clamp-2 text-sm font-semibold text-site-text"
      style={{
        fontSize: stylePolicy ? `${stylePolicy.titleFontSize}px` : undefined,
        color: stylePolicy?.textColor || undefined,
      }}
    >
      {data.cardTitle || "대회명"}
    </h3>
  );
  const dateBlock = (
    <p
      className="line-clamp-1 text-xs text-gray-600"
      style={{
        fontSize: stylePolicy ? `${stylePolicy.shortDescriptionFontSize}px` : undefined,
        color: stylePolicy?.textColor || undefined,
      }}
    >
      {data.displayDateText || "날짜"}
    </p>
  );
  const regionBlock = (
    <p
      className="line-clamp-1 text-xs text-gray-600"
      style={{
        fontSize: stylePolicy ? `${stylePolicy.shortDescriptionFontSize}px` : undefined,
        color: stylePolicy?.textColor || undefined,
      }}
    >
      {data.displayRegionText || "장소"}
    </p>
  );
  const statusInline = (
    <span
      className={`rounded-full bg-site-primary px-2.5 py-1 text-xs font-semibold text-white ${statusAlignClass(stylePolicy?.statusAlign ?? "right")}`}
      style={{ fontSize: stylePolicy ? `${stylePolicy.statusFontSize}px` : undefined }}
    >
      {data.statusText || "상태"}
    </span>
  );

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border border-site-border bg-site-card shadow-sm"
      style={
        stylePolicy
          ? {
              width: responsiveCardWidth,
              maxWidth: "100%",
              height: responsiveCardHeight,
              margin: `${stylePolicy.outerMargin}px`,
              backgroundColor: stylePolicy.backgroundColor,
            }
          : undefined
      }
    >
      <div
        className="relative w-full shrink-0 overflow-hidden bg-gray-100"
        style={responsiveImageAreaHeight != null ? { height: responsiveImageAreaHeight } : undefined}
      >
        {data.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {stylePolicy?.statusPosition === "top-left" ? (
          <span className="absolute left-2 top-2">{statusInline}</span>
        ) : null}
        {stylePolicy?.statusPosition === "top-right" || !stylePolicy ? (
          <span className="absolute right-2 top-2">{statusInline}</span>
        ) : null}
      </div>
      <div
        className={compact ? "flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-3" : "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3"}
        style={{ ...(textPadding ?? {}), rowGap: `${stylePolicy?.gapBetweenElements ?? 8}px` }}
      >
        {stylePolicy?.statusPosition === "title-above" ? statusInline : null}
        <div className="grid min-h-0 flex-1 grid-rows-3 overflow-hidden">
          <div className={`flex ${textAlignClass(stylePolicy?.titleAlign ?? "left")} ${textPositionClass(stylePolicy?.titlePosition ?? "top")}`}>
            {(stylePolicy?.titlePosition ?? "top") === "top" ? titleBlock : null}
          </div>
          <div className={`flex ${textAlignClass(stylePolicy?.titleAlign ?? "left")} ${textPositionClass(stylePolicy?.titlePosition ?? "top")}`}>
            {(stylePolicy?.titlePosition ?? "top") === "center" ? titleBlock : null}
          </div>
          <div className={`flex ${textAlignClass(stylePolicy?.titleAlign ?? "left")} ${textPositionClass(stylePolicy?.titlePosition ?? "top")}`}>
            {(stylePolicy?.titlePosition ?? "top") === "bottom" ? titleBlock : null}
          </div>
        </div>
        {stylePolicy?.statusPosition === "title-below" ? statusInline : null}
        <div className="grid min-h-0 flex-1 grid-rows-3 overflow-hidden" style={{ marginTop: `${stylePolicy?.titleContentGap ?? 6}px` }}>
          <div className={`flex ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "title-below" ? (
              <div className="w-full">
                {data.displayDateText ? dateBlock : null}
                {data.displayRegionText ? regionBlock : null}
                {!data.displayDateText && !data.displayRegionText ? dateBlock : null}
              </div>
            ) : null}
          </div>
          <div className={`flex ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "center" ? (
              <div className="w-full">
                {data.displayDateText ? dateBlock : null}
                {data.displayRegionText ? regionBlock : null}
                {!data.displayDateText && !data.displayRegionText ? dateBlock : null}
              </div>
            ) : null}
          </div>
          <div className={`flex ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "bottom" ? (
              <div className="w-full">
                {data.displayDateText ? dateBlock : null}
                {data.displayRegionText ? regionBlock : null}
                {!data.displayDateText && !data.displayRegionText ? dateBlock : null}
              </div>
            ) : null}
          </div>
        </div>
        {showDetailButton ? (
          <span className="mt-1 inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-site-border bg-site-bg px-3 py-2 text-xs font-medium text-site-text">
            {data.buttonText || "자세히 보기"}
          </span>
        ) : null}
      </div>
      {stylePolicy?.statusPosition === "bottom-right" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-end pr-2">{statusInline}</div>
      ) : null}
    </div>
  );
}

export function HighlightCard({
  data,
  compact = false,
  stylePolicy,
}: {
  data: TournamentPublishedCardViewModel;
  compact?: boolean;
  stylePolicy?: PlatformCardTemplateStylePolicy;
  showDetailButton?: boolean;
}) {
  const circleSize = Math.max(100, Math.min(stylePolicy?.cardWidth ?? 112, 360));
  const compactMobileWidthPx = compact && stylePolicy ? "46vw" : null;
  const responsiveCircleSize = compactMobileWidthPx
    ? `min(${circleSize}px, ${compactMobileWidthPx})`
    : `${circleSize}px`;

  return (
    <div
      className="relative flex flex-col items-center"
      style={
        stylePolicy
          ? {
              width: responsiveCircleSize,
              maxWidth: "100%",
              margin: `${stylePolicy.outerMargin}px`,
            }
          : undefined
      }
    >
      <div
        className="relative overflow-hidden rounded-full border border-site-border bg-gray-100"
        style={{ width: responsiveCircleSize, height: responsiveCircleSize }}
      >
        {data.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gray-200" />
        )}
      </div>
      <p
        className={`${compact ? "mt-1" : "mt-2"} line-clamp-2 text-center font-medium text-site-text`}
        style={{
          fontSize: stylePolicy ? `${stylePolicy.titleFontSize}px` : undefined,
          color: stylePolicy?.textColor || undefined,
        }}
      >
        {data.cardTitle || "상호명"}
      </p>
    </div>
  );
}
