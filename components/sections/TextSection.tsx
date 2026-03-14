"use client";

import type { PageSection } from "@/types/page-section";
import { SectionTitleWithIcon } from "@/components/content/SectionTitleWithIcon";

type Props = { section: PageSection };

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function TextSection({ section }: Props) {
  const align = alignClass[section.textAlign] ?? "text-center";
  const bg = section.backgroundColor?.trim();
  return (
    <section
      className={`border-b border-site-border py-8 sm:py-12 ${!bg ? "bg-site-card" : ""}`}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      <div className={`mx-auto max-w-3xl px-4 ${align}`}>
        {section.title && (
          <SectionTitleWithIcon section={section} title={section.title} />
        )}
        {section.subtitle && (
          <p className="mt-2 text-lg text-gray-600">{section.subtitle}</p>
        )}
        {section.description && (
          <p className="mt-4 text-base leading-relaxed text-gray-700">
            {section.description}
          </p>
        )}
      </div>
    </section>
  );
}
