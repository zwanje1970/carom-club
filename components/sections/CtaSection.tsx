"use client";

import { SmartLink } from "@/components/common/SmartLink";
import type { PageSection } from "@/types/page-section";

type Props = { section: PageSection };

const alignClass = {
  left: "text-left justify-start",
  center: "text-center justify-center",
  right: "text-right justify-end",
};

export function CtaSection({ section }: Props) {
  const align = alignClass[section.textAlign] ?? "text-center justify-center";
  const buttons = Array.isArray(section?.buttons) ? section.buttons : [];
  const hasButtons = buttons.length > 0;

  return (
    <section className="border-b border-site-border bg-site-card py-8 sm:py-12">
      <div className={`mx-auto max-w-3xl px-4 flex flex-col items-center ${align}`}>
        {section.title && (
          <h2 className="text-2xl font-bold text-site-text sm:text-3xl">
            {section.title}
          </h2>
        )}
        {section.subtitle && (
          <p className="mt-2 text-lg text-gray-600">{section.subtitle}</p>
        )}
        {section.description && (
          <p className="mt-4 text-base leading-relaxed text-gray-700">
            {section.description}
          </p>
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
    </section>
  );
}
