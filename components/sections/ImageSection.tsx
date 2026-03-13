"use client";

import { SmartLink } from "@/components/common/SmartLink";
import { INTERNAL_PAGE_PATHS } from "@/lib/content/constants";
import type { PageSection } from "@/types/page-section";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'%3E%3Crect fill='%23e5e7eb' width='800' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14'%3E이미지%3C/text%3E%3C/svg%3E";

type Props = { section: PageSection };

export function ImageSection({ section }: Props) {
  const imgUrl = section.imageUrl?.trim() || PLACEHOLDER;
  const heightPc = section.imageHeightPc ?? 320;
  const heightMobile = section.imageHeightMobile ?? 240;
  const hasLink =
    section.linkType === "internal" &&
      (section.internalPath || section.internalPage) ||
    (section.linkType === "external" && section.externalUrl);
  const href =
    section.linkType === "internal"
      ? section.internalPath ?? (section.internalPage ? INTERNAL_PAGE_PATHS[section.internalPage] : "#")
      : section.linkType === "external"
        ? section.externalUrl ?? "#"
        : "#";
  const internal = section.linkType === "internal";

  const image = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgUrl}
        alt={section.title || ""}
        className="hidden h-full w-full object-cover sm:block"
        style={{ height: heightPc }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={section.imageUrlMobile?.trim() || imgUrl}
        alt={section.title || ""}
        className="h-full w-full object-cover sm:hidden"
        style={{ height: heightMobile }}
      />
    </>
  );

  const wrapper = (
    <div className="relative w-full overflow-hidden bg-gray-100">
      {image}
    </div>
  );

  if (hasLink) {
    return (
      <SmartLink
        href={href}
        internal={internal}
        openInNewTab={section.openInNewTab}
        className="block"
      >
        {wrapper}
      </SmartLink>
    );
  }
  return wrapper;
}
