"use client";

import type { PageSection as PageSectionType } from "@/types/page-section";
import { PageSectionBlockRow } from "@/components/content/PageSectionBlockRow";

type Props = { sections?: PageSectionType[] | null };

/** CMS `PageSection[]` 전용 (기존 API 유지). 배열 기반 통합은 `PageRenderer` 사용. */
export function PageSectionsRenderer({ sections }: Props) {
  const list = Array.isArray(sections) ? sections : [];
  if (list.length === 0) return null;
  return (
    <>
      {list.map((section) => (
        <PageSectionBlockRow key={section.id} section={section} />
      ))}
    </>
  );
}
