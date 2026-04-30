"use client";

import { useCallback, useState } from "react";

type Props = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholderClassName: string;
  placeholderLabel?: string;
};

/** 목록 전용 160 썸네일 — 로드 실패 시 플레이스홀더(320/640 대체 없음) */
export default function SiteListImage160({
  src,
  alt,
  width,
  height,
  className,
  placeholderClassName,
  placeholderLabel = "이미지 없음",
}: Props) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => {
    setFailed(true);
  }, []);

  if (failed) {
    return (
      <div className={placeholderClassName} aria-hidden>
        {placeholderLabel}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  );
}
