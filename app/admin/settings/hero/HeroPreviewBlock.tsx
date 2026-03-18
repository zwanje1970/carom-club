"use client";

import Image from "next/image";
import type { HeroSettings } from "@/lib/hero-settings";
import { isOptimizableImageSrc, sanitizeImageSrc } from "@/lib/image-src";

const HERO_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='300'%3E%3Crect fill='%23e5e7eb' width='800' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='14'%3E배경 이미지%3C/text%3E%3C/svg%3E";

function buttonSizeClass(size: string): string {
  switch (size) {
    case "small":
      return "min-h-[32px] px-3 py-1.5 text-xs";
    case "large":
      return "min-h-[52px] px-8 py-4 text-base";
    default:
      return "min-h-[44px] px-6 py-3 text-sm";
  }
}

function buttonVariantClass(variant: string): string {
  switch (variant) {
    case "primary":
      return "bg-site-primary text-white hover:opacity-90";
    case "outline":
      return "border-2 border-white/80 bg-transparent text-white hover:bg-white/10";
    default:
      return "bg-white/20 text-white hover:bg-white/30";
  }
}

type Props = { settings: HeroSettings };

export default function HeroPreviewBlock({ settings }: Props) {
  const s = settings;
  if (!s.heroEnabled) {
    return (
      <div className="rounded bg-gray-100 py-8 text-center text-sm text-gray-500 dark:bg-slate-700 dark:text-slate-400">
        히어로가 비활성화되어 있습니다. 사용 여부를 켜면 미리보기가 표시됩니다.
      </div>
    );
  }

  const bgSrc = s.heroBackgroundImageUrl?.trim() || HERO_PLACEHOLDER;
  const textAlignClass =
    s.heroTextAlign === "left" ? "text-left" : s.heroTextAlign === "right" ? "text-right" : "text-center";
  const justifyClass =
    s.heroContentVerticalAlign === "top"
      ? "justify-start"
      : s.heroContentVerticalAlign === "bottom"
        ? "justify-end"
        : "justify-center";
  const buttonsAlignClass =
    s.heroButtonsAlign === "left" ? "justify-start" : s.heroButtonsAlign === "right" ? "justify-end" : "justify-center";
  const enabledButtons = s.heroButtons.filter((b) => b.enabled && b.label.trim());

  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{
        minHeight: "200px",
        height: "200px",
      }}
    >
      {/* background */}
      <div className="absolute inset-0">
        {(() => {
          const safeSrc = sanitizeImageSrc(bgSrc);
          if (!safeSrc) return null;
          if (!isOptimizableImageSrc(safeSrc)) {
            return (
              <img
                src={safeSrc}
                alt="히어로 배경 미리보기"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: s.heroBlurAmount > 0 ? `blur(${s.heroBlurAmount}px)` : undefined }}
              />
            );
          }
          return (
            <Image
              src={safeSrc}
              alt="히어로 배경 미리보기"
              fill
              className="object-cover"
              sizes="800px"
              unoptimized
              style={{
                filter: s.heroBlurAmount > 0 ? `blur(${s.heroBlurAmount}px)` : undefined,
              }}
            />
          );
        })()}
      </div>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${s.heroOverlayOpacity})` }}
      />
      {/* content */}
      <div
        className={`relative z-10 flex h-full flex-col px-4 py-4 text-white ${justifyClass}`}
        style={{ maxWidth: s.heroTextMaxWidth }}
      >
        <div className={`w-full ${textAlignClass}`}>
          {s.heroEyebrowText && (
            <p className="mb-1 text-xs opacity-90" style={{ fontSize: s.heroSubtitleSize }}>
              {s.heroEyebrowText}
            </p>
          )}
          <h1 className="font-bold leading-tight" style={{ fontSize: s.heroTitleSize }}>
            {s.heroTitle || "제목"}
          </h1>
          {s.heroSubtitle && (
            <p className="mt-1 opacity-95" style={{ fontSize: s.heroSubtitleSize }}>
              {s.heroSubtitle}
            </p>
          )}
          {s.heroButtonsPosition === "belowTitle" && enabledButtons.length > 0 && (
            <div className={`mt-3 flex flex-wrap gap-2 ${buttonsAlignClass}`}>
              {enabledButtons.map((btn, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center rounded-lg font-medium ${buttonSizeClass(btn.size)} ${buttonVariantClass(btn.variant)}`}
                >
                  {btn.label}
                </span>
              ))}
            </div>
          )}
          {s.heroButtonsPosition === "belowSubtitle" && enabledButtons.length > 0 && (
            <div className={`mt-3 flex flex-wrap gap-2 ${buttonsAlignClass}`}>
              {enabledButtons.map((btn, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center rounded-lg font-medium ${buttonSizeClass(btn.size)} ${buttonVariantClass(btn.variant)}`}
                >
                  {btn.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {s.heroButtonsPosition === "bottom" && enabledButtons.length > 0 && (
          <div className={`mt-auto flex flex-wrap gap-2 pt-3 ${buttonsAlignClass}`}>
            {enabledButtons.map((btn, i) => (
              <span
                key={i}
                className={`inline-flex items-center rounded-lg font-medium ${buttonSizeClass(btn.size)} ${buttonVariantClass(btn.variant)}`}
              >
                {btn.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
