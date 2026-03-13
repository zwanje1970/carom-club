"use client";

import type { PageSection } from "@/types/page-section";

type Props = { section: PageSection };

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function TextSection({ section }: Props) {
  const align = alignClass[section.textAlign] ?? "text-center";
  return (
    <section className="border-b border-site-border bg-site-card py-8 sm:py-12">
      <div className={`mx-auto max-w-3xl px-4 ${align}`}>
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
      </div>
    </section>
  );
}
