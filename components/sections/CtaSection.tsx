"use client";

import { SmartLink } from "@/components/common/SmartLink";
import type { PageSection } from "@/types/page-section";
import { SectionTitleWithIcon } from "@/components/content/SectionTitleWithIcon";
import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";
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

  const inner = (
    <div className={`mx-auto max-w-3xl px-4 flex flex-col items-center ${align}`}>
      {section.title && <SectionTitleWithIcon section={section} title={section.title} />}
      {section.subtitle && <p className="mt-2 text-lg text-gray-600">{section.subtitle}</p>}
      {section.description && (
        <p className="mt-4 text-base leading-relaxed text-gray-700">{section.description}</p>
      )}
      {hasButtons && (
        <div className="mt-6 flex flex-wrap gap-3">
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
    </div>
  );

  if (embedded) {
    return <div className="py-8 sm:py-12">{inner}</div>;
  }
  return (
    <section
      className="border-b border-site-border py-8 sm:py-12"
      style={bg ? { backgroundColor: bg } : undefined}
    >
      {inner}
    </section>
  );
}
