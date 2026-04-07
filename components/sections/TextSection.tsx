"use client";

import type { PageSection } from "@/types/page-section";
import { SectionTitleWithIcon } from "@/components/content/SectionTitleWithIcon";
import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";
import { SmartLink } from "@/components/common/SmartLink";
import { parseSectionStyleJson } from "@/lib/section-style";
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
  const showHeaderCta = hasCta && ctaPlacement === "headerRight";
  const showBottomCta = hasCta && ctaPlacement.startsWith("blockBottom");
  const showOutsideCta = hasCta && ctaPlacement.startsWith("outsideBottom");

  const inner = (
    <div className={cn("mx-auto max-w-3xl", PAGE_CONTENT_PAD_X, align)}>
      {section.title && <SectionTitleWithIcon section={section} title={section.title} />}
      {section.subtitle ? <p className="text-lg text-gray-600" style={{ marginTop: `${elementSpacingPx}px` }}>{section.subtitle}</p> : null}
      {showHeaderCta ? <div className={cn("flex", ctaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{ctaButton}</div> : null}
      {section.description && (
        <p className="text-base leading-relaxed text-gray-700" style={{ marginTop: `${elementSpacingPx}px` }}>{section.description}</p>
      )}
      {showBottomCta ? <div className={cn("flex", ctaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{ctaButton}</div> : null}
    </div>
  );
  if (embedded) {
    return (
      <>
        <div className="py-8 sm:py-12">{inner}</div>
        {showOutsideCta ? <div className={cn("px-4 pb-2 flex", ctaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{ctaButton}</div> : null}
      </>
    );
  }
  return (
    <>
      <section
        className="border-b border-site-border py-8 sm:py-12"
        style={bg ? { backgroundColor: bg } : undefined}
      >
        {inner}
      </section>
      {showOutsideCta ? <div className={cn(PAGE_CONTENT_PAD_X, "mx-auto max-w-3xl flex", ctaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{ctaButton}</div> : null}
    </>
  );
}
