"use client";

import type { CSSProperties } from "react";
import { ImageSection } from "@/components/sections/ImageSection";
import { TextSection } from "@/components/sections/TextSection";
import { CtaSection } from "@/components/sections/CtaSection";
import type { PageSection } from "@/types/page-section";
import { resolveSectionStyle, sectionAnimationClass } from "@/lib/section-style";
import { cn } from "@/lib/utils";

/**
 * 단일 `PageSection` 행 — 셸 + image|text|cta.
 * `PageSectionsRenderer`·`PageRenderer`가 공유 (CMS 행, `slotType` 없음 전제).
 */
export function PageSectionBlockRow({
  section,
  previewMode = "public",
}: {
  section: PageSection;
  previewMode?: "public" | "adminPreview";
}) {
  const resolved = resolveSectionStyle(section);
  const shellStyle: CSSProperties = {};
  if (resolved.backgroundColor) {
    shellStyle.backgroundColor = resolved.backgroundColor;
  }
  const divider = resolved.divider;
  const showDivider = divider.enabled && divider.style !== "none";
  const shellBorder = !showDivider;
  const shellClass = cn(
    "w-full",
    shellBorder && "border-b border-site-border",
    sectionAnimationClass(resolved.animationPreset),
    !resolved.backgroundColor && section.type === "image" && "bg-gray-100"
  );
  const dividerStyle: CSSProperties = showDivider
    ? {
        border: 0,
        borderTopWidth: divider.widthPx,
        borderTopStyle: divider.style === "dashed" ? "dashed" : "solid",
        borderTopColor: divider.color,
        margin: 0,
        opacity: 1,
      }
    : {};

  const inner =
    section.type === "image" ? (
      <ImageSection section={section} embedded />
    ) : section.type === "text" ? (
      <TextSection section={section} embedded />
    ) : section.type === "cta" ? (
      <CtaSection section={section} embedded />
    ) : null;

  if (!inner) return null;

  return (
    <section
      className={shellClass}
      style={Object.keys(shellStyle).length ? shellStyle : undefined}
      data-section-type={section.type}
    >
      {inner}
      {showDivider ? <hr className="w-full" style={dividerStyle} /> : null}
    </section>
  );
}
