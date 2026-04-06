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
  const imageAreaHeight = stylePolicy
    ? Math.max(0, Math.min(stylePolicy.imageAreaHeight, stylePolicy.cardHeight))
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
      {[data.displayDateText, data.displayRegionText].filter(Boolean).join(" · ") || "날짜 · 지역"}
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
              width: `${stylePolicy.cardWidth}px`,
              maxWidth: "100%",
              height: `${stylePolicy.cardHeight}px`,
              margin: `${stylePolicy.outerMargin}px`,
              backgroundColor: stylePolicy.backgroundColor,
            }
          : undefined
      }
    >
      <div
        className="relative w-full shrink-0 overflow-hidden bg-gray-100"
        style={imageAreaHeight != null ? { height: `${imageAreaHeight}px` } : undefined}
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
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "title-below" ? dateBlock : null}
          </div>
          <div className={`flex ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "center" ? dateBlock : null}
          </div>
          <div className={`flex ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "bottom" ? dateBlock : null}
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
  showDetailButton = true,
}: {
  data: TournamentPublishedCardViewModel;
  compact?: boolean;
  stylePolicy?: PlatformCardTemplateStylePolicy;
  showDetailButton?: boolean;
}) {
  const imageAreaHeight = stylePolicy
    ? Math.max(0, Math.min(stylePolicy.imageAreaHeight, stylePolicy.cardHeight))
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
      className="line-clamp-2 text-base font-semibold text-site-text"
      style={{
        fontSize: stylePolicy ? `${stylePolicy.titleFontSize}px` : undefined,
        color: stylePolicy?.textColor || undefined,
      }}
    >
      {data.cardTitle || "대회명"}
    </h3>
  );
  const descBlock = (
    <p
      className="line-clamp-2 text-xs text-gray-600"
      style={{
        fontSize: stylePolicy ? `${stylePolicy.shortDescriptionFontSize}px` : undefined,
        color: stylePolicy?.textColor || undefined,
      }}
    >
      {data.shortDescription || "짧은 설명"}
    </p>
  );
  const dateBlock = (
    <p
      className="line-clamp-1 text-xs text-gray-500"
      style={{
        fontSize: stylePolicy ? `${stylePolicy.shortDescriptionFontSize}px` : undefined,
        color: stylePolicy?.textColor || undefined,
      }}
    >
      {[data.displayDateText, data.displayRegionText].filter(Boolean).join(" · ") || "날짜 · 지역"}
    </p>
  );
  const statusInline = (
    <span
      className={`rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ${statusAlignClass(stylePolicy?.statusAlign ?? "left")}`}
      style={{ fontSize: stylePolicy ? `${stylePolicy.statusFontSize}px` : undefined }}
    >
      {data.statusText || "강조"}
    </span>
  );

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border border-site-border bg-site-card shadow-sm"
      style={
        stylePolicy
          ? {
              width: `${stylePolicy.cardWidth}px`,
              maxWidth: "100%",
              height: `${stylePolicy.cardHeight}px`,
              margin: `${stylePolicy.outerMargin}px`,
              backgroundColor: stylePolicy.backgroundColor,
            }
          : undefined
      }
    >
      <div
        className="relative w-full shrink-0 overflow-hidden bg-gray-100"
        style={imageAreaHeight != null ? { height: `${imageAreaHeight}px` } : undefined}
      >
        {data.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {stylePolicy?.statusPosition === "top-left" || !stylePolicy ? (
          <span className="absolute left-2 top-2">{statusInline}</span>
        ) : null}
        {stylePolicy?.statusPosition === "top-right" ? (
          <span className="absolute right-2 top-2">{statusInline}</span>
        ) : null}
      </div>
      <div
        className={compact ? "flex min-h-0 flex-1 flex-col space-y-1.5 overflow-hidden p-3" : "flex min-h-0 flex-1 flex-col space-y-2 overflow-hidden p-3"}
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
          <div className={`flex flex-col ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "title-below" ? (
              <>
                {descBlock}
                {dateBlock}
              </>
            ) : null}
          </div>
          <div className={`flex flex-col ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "center" ? (
              <>
                {descBlock}
                {dateBlock}
              </>
            ) : null}
          </div>
          <div className={`flex flex-col ${textAlignClass(stylePolicy?.shortDescriptionAlign ?? "left")} ${descriptionPositionClass(stylePolicy?.shortDescriptionPosition ?? "title-below")}`}>
            {(stylePolicy?.shortDescriptionPosition ?? "title-below") === "bottom" ? (
              <>
                {descBlock}
                {dateBlock}
              </>
            ) : null}
          </div>
        </div>
        {showDetailButton ? (
          <span className="mt-1 inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-site-primary px-3 py-2 text-xs font-medium text-white">
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
