"use client";

import Image from "next/image";
import { isOptimizableImageSrc, sanitizeImageSrc } from "@/lib/image-src";

const SIZE = 56;
const QUALITY = 75;

/**
 * 목록 썸네일: 로컬(`/uploads` 등)은 next/image로 리사이즈·작은 페이로드, 그 외는 일반 img + lazy.
 */
export function CommunityBoardPostThumb({ url }: { url: string | null | undefined }) {
  const raw = url?.trim();
  const src = sanitizeImageSrc(raw ?? null);
  if (!src) return null;

  if (src.startsWith("/") && isOptimizableImageSrc(src)) {
    return (
      <Image
        src={src}
        alt=""
        width={SIZE}
        height={SIZE}
        quality={QUALITY}
        sizes={`${SIZE}px`}
        loading="lazy"
        className="h-14 w-14 shrink-0 rounded-md object-cover bg-gray-100 dark:bg-slate-700"
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={SIZE}
      height={SIZE}
      loading="lazy"
      decoding="async"
      className="h-14 w-14 shrink-0 rounded-md object-cover bg-gray-100 dark:bg-slate-700"
    />
  );
}
