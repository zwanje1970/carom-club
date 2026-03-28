"use client";

import Image from "next/image";
import { SmartLink } from "@/components/common/SmartLink";
import { INTERNAL_PAGE_PATHS } from "@/lib/content/constants";
import { IMAGE_PLACEHOLDER_SRC, isOptimizableImageSrc, sanitizeImageSrc } from "@/lib/image-src";
import type { PageSection } from "@/types/page-section";

/** 풀폭 섹션: 표시 너비에 맞춘 sizes (과대 디코딩 방지) */
const SECTION_IMAGE_SIZES = "(max-width: 639px) 100vw, min(1200px, 100vw)";

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'%3E%3Crect fill='%23e5e7eb' width='800' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14'%3E이미지%3C/text%3E%3C/svg%3E";

type Props = {
  section: PageSection;
  /** PageSectionsRenderer 외곽에서 배경·보더 처리 시 내부 배경 제거 */
  embedded?: boolean;
};

function SectionImageCell({ src, alt }: { src: string; alt: string }) {
  const safeSrc = sanitizeImageSrc(src);
  if (!safeSrc) {
    return <img src={IMAGE_PLACEHOLDER_SRC} alt={alt} className="absolute inset-0 w-full h-full object-cover" />;
  }
  if (isOptimizableImageSrc(safeSrc)) {
    return (
      <Image
        src={safeSrc}
        alt={alt}
        fill
        sizes={SECTION_IMAGE_SIZES}
        quality={78}
        className="object-cover"
        data-debug-src={safeSrc}
      />
    );
  }
  return (
    <img
      src={safeSrc}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover min-h-[80px]"
      data-debug-src={safeSrc}
    />
  );
}

export function ImageSection({ section, embedded = false }: Props) {
  const imgUrl = section.imageUrl?.trim() || PLACEHOLDER;
  const imgUrlMobile = section.imageUrlMobile?.trim() || imgUrl;
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
      <div className="relative hidden w-full overflow-hidden sm:block" style={{ height: heightPc }}>
        <SectionImageCell src={imgUrl} alt={section.title || ""} />
      </div>
      <div className="relative block w-full overflow-hidden sm:hidden" style={{ height: heightMobile }}>
        <SectionImageCell src={imgUrlMobile} alt={section.title || ""} />
      </div>
    </>
  );

  const bg = embedded ? undefined : section.backgroundColor?.trim();
  const wrapper = (
    <div
      className={`relative w-full overflow-hidden ${!embedded && !bg ? "bg-gray-100" : ""}`}
      style={bg ? { backgroundColor: bg } : undefined}
    >
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
