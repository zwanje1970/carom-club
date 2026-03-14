"use client";

import type { PageSection } from "@/types/page-section";

type Props = { section: PageSection; title: string; className?: string };

/** 제목 왼쪽에 아이콘/이미지(관리자 설정) + 제목. 값 없으면 제목만. */
export function SectionTitleWithIcon({ section, title, className = "" }: Props) {
  const type = section.titleIconType ?? "none";
  const size = section.titleIconSize === "medium" ? "medium" : "small";
  const sizeClass = size === "medium" ? "w-6 h-6" : "w-[18px] h-[18px]";

  const iconEl =
    type === "image" && section.titleIconImageUrl?.trim() ? (
      <img
        src={section.titleIconImageUrl.trim()}
        alt=""
        className={`shrink-0 ${sizeClass} object-contain`}
        width={size === "medium" ? 24 : 18}
        height={size === "medium" ? 24 : 18}
      />
    ) : type === "icon" && section.titleIconName?.trim() ? (
      <span
        className={`shrink-0 ${sizeClass} flex items-center justify-center text-current text-[1rem] leading-none`}
        style={{ fontSize: size === "medium" ? "1.25rem" : "1.125rem" }}
        aria-hidden
      >
        {section.titleIconName.trim()}
      </span>
    ) : null;

  return (
    <h2 className={`inline-flex items-center gap-2 text-2xl font-bold text-site-text sm:text-3xl ${className}`}>
      {iconEl}
      <span>{title}</span>
    </h2>
  );
}
