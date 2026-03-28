"use client";

import type { PageSection } from "@/types/page-section";
import { SectionTitleWithIcon } from "@/components/content/SectionTitleWithIcon";

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
  const inner = (
    <div className={`mx-auto max-w-3xl px-4 ${align}`}>
      {section.title && <SectionTitleWithIcon section={section} title={section.title} />}
      {section.subtitle && <p className="mt-2 text-lg text-gray-600">{section.subtitle}</p>}
      {section.description && (
        <p className="mt-4 text-base leading-relaxed text-gray-700">{section.description}</p>
      )}
    </div>
  );
  if (embedded) {
    return <div className="py-8 sm:py-12">{inner}</div>;
  }
  return (
    <section
      className={`border-b border-site-border py-8 sm:py-12 ${!bg ? "bg-site-card" : ""}`}
      style={bg ? { backgroundColor: bg } : undefined}
    >
      {inner}
    </section>
  );
}
