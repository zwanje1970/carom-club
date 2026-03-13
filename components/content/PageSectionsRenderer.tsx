"use client";

import { ImageSection } from "@/components/sections/ImageSection";
import { TextSection } from "@/components/sections/TextSection";
import { CtaSection } from "@/components/sections/CtaSection";
import type { PageSection as PageSectionType } from "@/types/page-section";

type Props = { sections?: PageSectionType[] | null };

export function PageSectionsRenderer({ sections }: Props) {
  const list = Array.isArray(sections) ? sections : [];
  if (list.length === 0) return null;
  return (
    <>
      {list.map((section) => {
        if (section.type === "image") {
          return <ImageSection key={section.id} section={section} />;
        }
        if (section.type === "text") {
          return <TextSection key={section.id} section={section} />;
        }
        if (section.type === "cta") {
          return <CtaSection key={section.id} section={section} />;
        }
        return null;
      })}
    </>
  );
}
