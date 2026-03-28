"use client";

import Image from "next/image";
import Link from "next/link";
import { isOptimizableImageSrc, sanitizeImageSrc } from "@/lib/image-src";
import type { HeroSettings } from "@/lib/hero-settings";

/** 뷰포트별 요청 너비 — 모바일 100vw, 태블릿·데스크톱은 과대 픽셀 방지 */
const HERO_IMAGE_SIZES = "(max-width: 768px) 100vw, (max-width: 1280px) 90vw, min(1200px, 85vw)";

function buttonSizeClass(size: "small" | "medium" | "large"): string {
  const base =
    "inline-flex items-center justify-center rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2";
  switch (size) {
    case "small":
      return `${base} min-h-[32px] px-4 py-2 text-xs`;
    case "large":
      return `${base} min-h-[52px] px-8 py-4 text-base`;
    default:
      return `${base} min-h-[44px] px-6 py-3 text-sm`;
  }
}

function buttonVariantClass(variant: "primary" | "secondary" | "outline"): string {
  switch (variant) {
    case "primary":
      return "bg-site-primary text-white shadow-sm hover:opacity-90";
    case "outline":
      return "border-2 border-white/90 bg-transparent text-white hover:bg-white/10";
    default:
      return "bg-white/20 text-white hover:bg-white/30";
  }
}

export type HomeHeroProps = {
  heroSettings: HeroSettings;
};

/**
 * 메인 히어로 — SiteSetting.heroSettingsJson 단일 소스.
 * heroEnabled === false 이면 영역을 렌더하지 않음(히어로 숨김).
 */
export function HomeHero({ heroSettings }: HomeHeroProps) {
  if (!heroSettings.heroEnabled) {
    return null;
  }
  return <HomeHeroFromSettings settings={heroSettings} />;
}

function HomeHeroFromSettings({ settings }: { settings: HeroSettings }) {
  const s = settings;
  const hasBgImage = !!s.heroBackgroundImageUrl?.trim();
  const bgSrc = hasBgImage ? (s.heroBackgroundImageUrl?.trim() ?? "") : "";
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

  const buttonsBlock =
    enabledButtons.length > 0 ? (
      <div className={`flex w-full flex-wrap gap-3 sm:gap-4 ${buttonsAlignClass}`}>
        {enabledButtons.map((btn, i) => (
          <Link
            key={i}
            href={btn.href || "#"}
            target={btn.openInNewTab ? "_blank" : undefined}
            rel={btn.openInNewTab ? "noopener noreferrer" : undefined}
            className={`${buttonSizeClass(btn.size)} ${buttonVariantClass(btn.variant)}`}
          >
            {btn.label}
          </Link>
        ))}
      </div>
    ) : null;

  const textBlock = (
    <div className={`w-full min-h-[7.5rem] sm:min-h-[8rem] ${textAlignClass}`} style={{ maxWidth: s.heroTextMaxWidth }}>
      {s.heroEyebrowText && (
        <p className="mb-1 min-h-[1.25em] text-white/90" style={{ fontSize: s.heroSubtitleSize }}>
          {s.heroEyebrowText}
        </p>
      )}
      <h1 className="font-bold leading-tight text-white min-h-[2.5em] md:block hidden" style={{ fontSize: s.heroTitleSize }}>
        {s.heroTitle || "CAROM.CLUB"}
      </h1>
      {s.heroSubtitle && (
        <p className="mt-1 min-h-[1.25em] text-white/95" style={{ fontSize: s.heroSubtitleSize }}>
          {s.heroSubtitle}
        </p>
      )}
      {s.heroButtonsPosition === "belowTitle" && <div className="mt-6">{buttonsBlock}</div>}
      {s.heroButtonsPosition === "belowSubtitle" && <div className="mt-6">{buttonsBlock}</div>}
    </div>
  );

  const itemsClass =
    s.heroTextAlign === "left" ? "items-start" : s.heroTextAlign === "right" ? "items-end" : "items-center";
  const content = (
    <div className={`relative z-10 flex w-full flex-1 flex-col px-4 py-6 min-h-[160px] ${justifyClass} ${itemsClass}`}>
      {textBlock}
      {s.heroButtonsPosition === "bottom" && <div className="mt-auto pt-6">{buttonsBlock}</div>}
    </div>
  );

  const mobileHeight = s.heroHeightMobile || "280px";
  const desktopHeight = s.heroHeightDesktop || "380px";

  return (
    <section className="hero-section-new relative min-h-[280px] overflow-hidden border-b border-site-border flex-shrink-0 w-full md:min-h-[320px]">
      <style
        dangerouslySetInnerHTML={{
          __html: `.hero-section-new{min-height:${mobileHeight}}@media(min-width:768px){.hero-section-new{min-height:${desktopHeight}}}.hero-block-new{position:absolute;inset:0;min-height:${mobileHeight}}@media(min-width:768px){.hero-block-new{min-height:${desktopHeight}}}`,
        }}
      />
      <div className="hero-block-new flex flex-col items-center py-10 sm:py-12 md:py-12 w-full">
        {(() => {
          const safeBg = sanitizeImageSrc(bgSrc);
          if (!safeBg) return null;
          return (
            <div className="absolute inset-0">
              {isOptimizableImageSrc(safeBg) ? (
                <Image
                  src={safeBg}
                  alt="히어로 배경"
                  fill
                  priority
                  quality={75}
                  sizes={HERO_IMAGE_SIZES}
                  className="object-cover pointer-events-none"
                  style={{ filter: s.heroBlurAmount > 0 ? `blur(${s.heroBlurAmount}px)` : undefined }}
                  data-debug-src={safeBg}
                />
              ) : (
                <img
                  src={safeBg}
                  alt="히어로 배경"
                  fetchPriority="high"
                  width={1920}
                  height={1080}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                  style={{ filter: s.heroBlurAmount > 0 ? `blur(${s.heroBlurAmount}px)` : undefined }}
                  data-debug-src={safeBg}
                />
              )}
            </div>
          );
        })()}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(0,0,0,${s.heroOverlayOpacity})` }}
        />
        <div className="relative z-10 w-full flex flex-col flex-1 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {content}
        </div>
      </div>
    </section>
  );
}
