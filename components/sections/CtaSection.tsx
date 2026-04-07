"use client";

import { SmartLink } from "@/components/common/SmartLink";
import type { PageSection } from "@/types/page-section";
import { SectionTitleWithIcon } from "@/components/content/SectionTitleWithIcon";
import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";
import { parseSectionStyleJson } from "@/lib/section-style";
import { cn } from "@/lib/utils";

type Props = {
  section: PageSection;
  embedded?: boolean;
};

const alignClass = {
  left: "text-left justify-start",
  center: "text-center justify-center",
  right: "text-right justify-end",
};

export function CtaSection({ section, embedded = false }: Props) {
  const align = alignClass[section.textAlign] ?? "text-center justify-center";
  const buttons = Array.isArray(section?.buttons) ? section.buttons : [];
  const hasButtons = buttons.length > 0;
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
  const contentCtaMode = String((style as Record<string, unknown>).contentMode ?? "cms");
  const contentCtaHref = String((style as Record<string, unknown>).contentCtaLink ?? "").trim();
  const contentCtaPlacement = String((style as Record<string, unknown>).contentCtaPlacement ?? "headerRight");
  const hasContentCta = !hasButtons && contentCtaMode === "cta" && contentCtaHref.length > 0;
  const contentCtaAlignClass = (() => {
    if (contentCtaPlacement === "headerRight" || contentCtaPlacement.endsWith("Right")) return "justify-end";
    if (contentCtaPlacement.endsWith("Center")) return "justify-center";
    return "justify-start";
  })();
  const contentCtaButton = hasContentCta ? (
    <SmartLink
      href={contentCtaHref}
      internal={contentCtaHref.startsWith("/")}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-site-primary px-6 py-3 text-sm font-medium text-white hover:opacity-90"
    >
      전체 보기
    </SmartLink>
  ) : null;
  const showHeaderCta = hasContentCta && contentCtaPlacement === "headerRight";
  const showBottomCta = hasContentCta && contentCtaPlacement.startsWith("blockBottom");
  const showOutsideCta = hasContentCta && contentCtaPlacement.startsWith("outsideBottom");

  const inner = (
    <div className={`mx-auto max-w-3xl px-4 flex flex-col items-center ${align}`}>
      {section.title && <SectionTitleWithIcon section={section} title={section.title} />}
      {section.subtitle ? <p className="text-lg text-gray-600" style={{ marginTop: `${elementSpacingPx}px` }}>{section.subtitle}</p> : null}
      {section.description && (
        <p className="text-base leading-relaxed text-gray-700" style={{ marginTop: `${elementSpacingPx}px` }}>{section.description}</p>
      )}
      {hasButtons && (
        <div className="flex flex-wrap gap-3" style={{ marginTop: `${blockSpacingPx}px` }}>
          {buttons.map((btn) => (
            <SmartLink
              key={btn.id}
              href={btn.href}
              internal={btn.linkType === "internal"}
              openInNewTab={btn.openInNewTab}
              className={
                btn.isPrimary
                  ? "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-site-primary px-6 py-3 text-sm font-medium text-white hover:opacity-90"
                  : "inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-site-primary bg-transparent px-6 py-3 text-sm font-medium text-site-primary hover:bg-site-primary/5"
              }
            >
              {btn.name}
            </SmartLink>
          ))}
        </div>
      )}
      {showHeaderCta ? <div className={cn("flex w-full", contentCtaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{contentCtaButton}</div> : null}
      {showBottomCta ? <div className={cn("flex w-full", contentCtaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{contentCtaButton}</div> : null}
    </div>
  );

  if (embedded) {
    return (
      <>
        <div className="py-8 sm:py-12">{inner}</div>
        {showOutsideCta ? <div className={cn("px-4 pb-2 flex", contentCtaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{contentCtaButton}</div> : null}
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
      {showOutsideCta ? <div className={cn(PAGE_CONTENT_PAD_X, "mx-auto max-w-3xl flex", contentCtaAlignClass)} style={{ marginTop: `${blockSpacingPx}px` }}>{contentCtaButton}</div> : null}
    </>
  );
}
