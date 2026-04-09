"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { PageSection } from "@/types/page-section";
import { SectionTitleWithIcon } from "@/components/content/SectionTitleWithIcon";
import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";
import { SmartLink } from "@/components/common/SmartLink";
import { parseSectionStyleJson } from "@/lib/section-style";
import { BasicCard, HighlightCard } from "@/components/cards/TournamentPublishedCard";
import { resolvePlatformCardTemplateStylePolicy } from "@/lib/platform-card-templates";
import { cn } from "@/lib/utils";

type Props = {
  section: PageSection;
  embedded?: boolean;
};

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function TextSection({ section, embedded = false }: Props) {
  const align = alignClass[section.textAlign] ?? "text-center";
  const bg = embedded ? undefined : section.backgroundColor?.trim();
  const style = parseSectionStyleJson(section.sectionStyleJson);
  const legacyPreset =
    String((style as Record<string, unknown>).contentSpacingPreset ?? "normal") === "compact"
      ? "compact"
      : String((style as Record<string, unknown>).contentSpacingPreset ?? "normal") === "wide"
        ? "wide"
        : "normal";
  const spacingMode =
    String((style as Record<string, unknown>).spacingMode ?? "preset") === "custom" ? "custom" : "preset";
  const blockPreset =
    (String((style as Record<string, unknown>).blockSpacingPreset ?? legacyPreset) as "compact" | "normal" | "wide") ||
    "normal";
  const elementPreset =
    (String((style as Record<string, unknown>).elementSpacingPreset ?? legacyPreset) as "compact" | "normal" | "wide") ||
    "normal";
  const spacingPresetToPx = (group: "block" | "element", preset: "compact" | "normal" | "wide") => {
    if (group === "block") {
      if (preset === "compact") return 8;
      if (preset === "wide") return 22;
      return 14;
    }
    if (preset === "compact") return 4;
    if (preset === "wide") return 12;
    return 8;
  };
  const blockSpacingPx =
    spacingMode === "custom"
      ? Math.max(0, Math.min(48, Math.round(Number((style as Record<string, unknown>).blockSpacingPx ?? spacingPresetToPx("block", blockPreset)))))
      : spacingPresetToPx("block", blockPreset);
  const elementSpacingPx =
    spacingMode === "custom"
      ? Math.max(0, Math.min(48, Math.round(Number((style as Record<string, unknown>).elementSpacingPx ?? spacingPresetToPx("element", elementPreset)))))
      : spacingPresetToPx("element", elementPreset);
  const ctaMode = String((style as Record<string, unknown>).contentMode ?? "cms");
  const ctaHref = String((style as Record<string, unknown>).contentCtaLink ?? "").trim();
  const ctaPlacement = String((style as Record<string, unknown>).contentCtaPlacement ?? "headerRight");
  const hasCta = ctaMode === "cta" && ctaHref.length > 0;
  const ctaAlignClass = (() => {
    if (ctaPlacement === "headerRight" || ctaPlacement.endsWith("Right")) return "justify-end";
    if (ctaPlacement.endsWith("Center")) return "justify-center";
    return "justify-start";
  })();
  const ctaButton = hasCta ? (
    <SmartLink
      href={ctaHref}
      internal={ctaHref.startsWith("/")}
      className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-site-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      전체 보기
    </SmartLink>
  ) : null;
  const showHeaderCta =
    hasCta && (ctaPlacement === "headerRight" || ctaPlacement.startsWith("top"));
  const showInsideCta =
    hasCta &&
    (ctaPlacement.startsWith("inside") ||
      ctaPlacement.startsWith("bottom") ||
      ctaPlacement.startsWith("blockBottom"));
  const showOutsideTopCta = hasCta && ctaPlacement.startsWith("outsideTop");
  const showOutsideBottomCta = hasCta && ctaPlacement.startsWith("outsideBottom");
  const rawElements = (style as Record<string, unknown>).contentElements;
  const firstTextElement = Array.isArray(rawElements)
    ? rawElements.find((it) => {
        if (!it || typeof it !== "object") return false;
        return String((it as Record<string, unknown>).type ?? "") === "text";
      }) ?? null
    : null;
  const textColorFromElement =
    firstTextElement && typeof firstTextElement === "object"
      ? String((firstTextElement as Record<string, unknown>).textColor ?? "").trim()
      : "";
  const textSizeFromElementRaw =
    firstTextElement && typeof firstTextElement === "object"
      ? Number((firstTextElement as Record<string, unknown>).textSize)
      : Number.NaN;
  const textColorFromElementNormalized = /^#[0-9a-fA-F]{6}$/.test(textColorFromElement)
    ? textColorFromElement
    : undefined;
  const textSizeFromElementNormalized =
    Number.isFinite(textSizeFromElementRaw) && textSizeFromElementRaw > 0
      ? Math.max(10, Math.min(48, Math.round(textSizeFromElementRaw)))
      : undefined;
  const titleTextStyle: CSSProperties | undefined =
    textColorFromElementNormalized || textSizeFromElementNormalized
      ? {
          color: textColorFromElementNormalized,
          fontSize:
            textSizeFromElementNormalized != null
              ? `${textSizeFromElementNormalized}px`
              : undefined,
        }
      : undefined;
  const bodyTextStyle: CSSProperties =
    textColorFromElementNormalized || textSizeFromElementNormalized
      ? {
          color: textColorFromElementNormalized,
          fontSize:
            textSizeFromElementNormalized != null
              ? `${textSizeFromElementNormalized}px`
              : undefined,
        }
      : {};
  const firstCardElement = Array.isArray(rawElements)
    ? rawElements.find((it) => {
        if (!it || typeof it !== "object") return false;
        return String((it as Record<string, unknown>).type ?? "") === "card";
      }) ?? null
    : null;
  const cardKindFromElement =
    firstCardElement && typeof firstCardElement === "object"
      ? String((firstCardElement as Record<string, unknown>).cardKind ?? "")
      : "";
  const cardKind = String((style as Record<string, unknown>).cardKind ?? cardKindFromElement);
  const publishedLoadMode = String((style as Record<string, unknown>).publishedCardLoadMode ?? "latest");
  const publishedPickKey = String((style as Record<string, unknown>).publishedCardPickKey ?? "").trim();
  const publishedTakeRaw = Number((style as Record<string, unknown>).publishedCardTake ?? 6);
  const publishedTake = [4, 6, 8].includes(publishedTakeRaw) ? publishedTakeRaw : 6;
  const [publishedTournaments, setPublishedTournaments] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (cardKind !== "publishedTournament") {
      setPublishedTournaments([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const take = Math.max(1, Math.min(50, publishedTake));
        const res = await fetch(`/api/home/tournaments?sortBy=latest&take=${take}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setPublishedTournaments([]);
          return;
        }
        const list = (await res.json()) as Array<Record<string, unknown>>;
        const normalized = Array.isArray(list) ? list : [];
        const filtered =
          publishedLoadMode === "manual" && publishedPickKey
            ? normalized.filter((it) => String(it?.id ?? "") === publishedPickKey)
            : normalized;
        if (!cancelled) setPublishedTournaments(filtered.slice(0, take));
      } catch {
        if (!cancelled) setPublishedTournaments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardKind, publishedTake, publishedLoadMode, publishedPickKey]);

  const basicStylePolicy = useMemo(
    () => resolvePlatformCardTemplateStylePolicy(null, "basic"),
    []
  );
  const highlightStylePolicy = useMemo(
    () => resolvePlatformCardTemplateStylePolicy(null, "highlight"),
    []
  );

  const cardElement =
    cardKind === "publishedTournament" ? (
      publishedTournaments.length > 0 ? (
        <div className="mt-4 -mx-1 flex gap-3 overflow-x-auto pb-2">
          {publishedTournaments.map((item, idx) => {
            const templateType = String(item.templateType ?? "basic") === "highlight" ? "highlight" : "basic";
            const data = {
              templateType,
              thumbnailUrl: String(item.thumbnailUrl ?? item.posterImageUrl ?? item.imageUrl ?? ""),
              cardTitle: String(item.cardTitle ?? item.name ?? ""),
              displayDateText: String(item.displayDateText ?? ""),
              displayRegionText: String(item.displayRegionText ?? ""),
              statusText: String(item.statusText ?? item.status ?? ""),
              buttonText: String(item.buttonText ?? "자세히 보기"),
              shortDescription: String(item.shortDescription ?? item.summary ?? ""),
            } as const;
            return (
              <div key={`text-card-${String(item.id ?? idx)}-${idx}`} className="shrink-0">
                <SmartLink
                  href={`/tournaments/${String(item.id ?? "").trim()}`}
                  internal
                  className="block"
                >
                  {templateType === "highlight" ? (
                    <HighlightCard data={data} compact stylePolicy={highlightStylePolicy} showDetailButton={false} />
                  ) : (
                    <BasicCard data={data} compact stylePolicy={basicStylePolicy} showDetailButton={false} />
                  )}
                </SmartLink>
              </div>
            );
          })}
        </div>
      ) : null
    ) : cardKind === "publishedVenue" ? (
      <div className="mt-4">
        <SmartLink
          href={
            publishedPickKey
              ? `/venues/${publishedPickKey}`
              : "/venues"
          }
          internal
          className="block w-fit"
        >
          <HighlightCard
            data={{
              templateType: "highlight",
              thumbnailUrl: String((style as Record<string, unknown>).cardBackgroundImage ?? section.imageUrl ?? ""),
              cardTitle: section.title || "당구장 메인 게시카드",
              displayDateText: "",
              displayRegionText: "",
              statusText: "",
              buttonText: "",
              shortDescription: "",
            }}
            compact
            stylePolicy={highlightStylePolicy}
            showDetailButton={false}
          />
        </SmartLink>
      </div>
    ) : null;

  const inner = (
    <div className={cn("mx-auto max-w-3xl", PAGE_CONTENT_PAD_X, align)}>
      {section.title && (
        <SectionTitleWithIcon section={section} title={section.title} titleStyle={titleTextStyle} />
      )}
      {section.subtitle ? (
        <p
          className="text-lg text-gray-600"
          style={{ marginTop: `${elementSpacingPx}px`, ...bodyTextStyle }}
        >
          {section.subtitle}
        </p>
      ) : null}
      {showHeaderCta ? <div className={cn("flex", ctaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{ctaButton}</div> : null}
      {section.description && (
        <p
          className="text-base leading-relaxed text-gray-700"
          style={{ marginTop: `${elementSpacingPx}px`, ...bodyTextStyle }}
        >
          {section.description}
        </p>
      )}
      {cardElement}
      {showInsideCta ? <div className={cn("flex", ctaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{ctaButton}</div> : null}
    </div>
  );
  if (embedded) {
    return (
      <div className="relative">
        {showOutsideTopCta ? (
          <div className={cn("pointer-events-none absolute inset-x-0 bottom-full z-10 mb-2 flex px-4", ctaAlignClass)}>
            <div className="pointer-events-auto">{ctaButton}</div>
          </div>
        ) : null}
        <div className="py-8 sm:py-12">{inner}</div>
        {showOutsideBottomCta ? (
          <div className={cn("pointer-events-none absolute inset-x-0 top-full z-10 mt-2 flex px-4", ctaAlignClass)}>
            <div className="pointer-events-auto">{ctaButton}</div>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <>
      {showOutsideTopCta ? <div className={cn(PAGE_CONTENT_PAD_X, "mx-auto max-w-3xl flex", ctaAlignClass)}>{ctaButton}</div> : null}
      <section
        className="border-b border-site-border py-8 sm:py-12"
        style={bg ? { backgroundColor: bg } : undefined}
      >
        {inner}
      </section>
      {showOutsideBottomCta ? <div className={cn(PAGE_CONTENT_PAD_X, "mx-auto max-w-3xl flex", ctaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{ctaButton}</div> : null}
    </>
  );
}
