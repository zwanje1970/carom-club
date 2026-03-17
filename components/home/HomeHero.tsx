"use client";

import Link from "next/link";
import Image from "next/image";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import type { HeroContent as HeroContentType } from "@/lib/content/hero-from-section";
import type { HeroSettings } from "@/lib/hero-settings";

function getHeroTitleStyle(copy: Record<string, string>): { style: React.CSSProperties; alignClass: string } {
  const style: React.CSSProperties = {};
  const font = (copy["site.hero.titleFont"] ?? "").trim();
  const size = (copy["site.hero.titleSize"] ?? "").trim();
  const color = (copy["site.hero.titleColor"] ?? "").trim();
  const lineHeight = (copy["site.hero.titleLineHeight"] ?? "").trim();
  const align = (copy["site.hero.titleAlign"] ?? "").trim();
  if (font && font !== "sans" && font !== "serif") style.fontFamily = font;
  if (color) style.color = color;
  if (lineHeight) style.lineHeight = lineHeight;
  if (size && /^\d+px$/i.test(size)) style.fontSize = size;
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return { style, alignClass };
}

function buttonSizeClassLegacy(size: "sm" | "md" | "lg" | undefined): string {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2";
  switch (size) {
    case "sm":
      return `${base} min-h-[36px] px-4 py-2 text-xs`;
    case "lg":
      return `${base} min-h-[52px] px-8 py-4 text-base`;
    default:
      return `${base} min-h-[44px] px-6 py-3 text-sm`;
  }
}

function buttonSizeClassNew(size: "small" | "medium" | "large"): string {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-2";
  switch (size) {
    case "small":
      return `${base} min-h-[32px] px-4 py-2 text-xs`;
    case "large":
      return `${base} min-h-[52px] px-8 py-4 text-base`;
    default:
      return `${base} min-h-[44px] px-6 py-3 text-sm`;
  }
}

function buttonVariantClassNew(variant: "primary" | "secondary" | "outline"): string {
  switch (variant) {
    case "primary":
      return "bg-site-primary text-white shadow-sm hover:opacity-90";
    case "outline":
      return "border-2 border-white/90 bg-transparent text-white hover:bg-white/10";
    default:
      return "bg-white/20 text-white hover:bg-white/30";
  }
}

type HomeHeroProps = {
  copy: Record<string, string>;
  hero?: HeroContentType | null;
  heroSettings?: HeroSettings | null;
};

export function HomeHero({ copy, hero, heroSettings }: HomeHeroProps) {
  const useNewHero = heroSettings?.heroEnabled && heroSettings !== null;

  if (useNewHero) {
    return <HomeHeroFromSettings settings={heroSettings!} />;
  }

  const hasBanner = hero?.heroImageUrl?.trim();
  const bannerSrc = hasBanner ? hero!.heroImageUrl! : "";
  const titleHtml = (copy["site.hero.titleHtml"] ?? "").trim();
  const { style: titleStyle, alignClass: titleAlignClass } = getHeroTitleStyle(copy);
  const isOverlay = !!hasBanner;
  const buttonsAbove = hero?.heroBtnPosition === "above";
  const heroButtons =
    hero?.heroButtons?.length
      ? hero.heroButtons
      : [
          { label: getCopyValue(copy as Record<AdminCopyKey, string>, "site.hero.btnTournaments"), href: "/tournaments", size: "md" as const },
          { label: getCopyValue(copy as Record<AdminCopyKey, string>, "site.hero.btnApply"), href: "/tournaments", size: "md" as const },
        ];

  const titleBlock = (
    <div
      className={`hero-html prose prose-p:my-0.5 max-w-none text-3xl md:text-6xl ${titleAlignClass} ${isOverlay ? "text-white [&_*]:text-inherit" : "text-site-text"}`}
      style={Object.keys(titleStyle).length ? titleStyle : undefined}
      dangerouslySetInnerHTML={{ __html: titleHtml || "<p>CAROM.CLUB</p>" }}
    />
  );

  const buttonsBlock = heroButtons.length > 0 ? (
    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4">
      {heroButtons.map((btn, i) => (
        <Link
          key={i}
          href={btn.href}
          className={
            i === 0
              ? `bg-site-primary text-white shadow-sm hover:opacity-90 px-4 py-2 text-sm md:px-8 md:py-4 md:text-lg inline-flex items-center justify-center rounded-xl font-medium min-h-[36px] md:min-h-[52px]`
              : `border-2 border-site-primary bg-site-card text-site-primary hover:bg-site-primary/5 px-4 py-2 text-sm md:px-8 md:py-4 md:text-lg inline-flex items-center justify-center rounded-xl font-medium min-h-[36px] md:min-h-[52px]`
          }
        >
          {btn.label}
        </Link>
      ))}
    </div>
  ) : null;

  const content = (
    <div
      className={`relative z-10 w-full flex flex-col justify-center px-4 leading-tight py-4 md:py-6 ${
        isOverlay ? "text-white [&_.hero-html]:text-inherit" : ""
      }`}
    >
      {buttonsAbove && buttonsBlock}
      <div className={buttonsAbove ? "mt-2 md:mt-4" : ""}>{titleBlock}</div>
      {!buttonsAbove && <div className="mt-4 md:mt-8">{buttonsBlock}</div>}
    </div>
  );

  return (
    <section className="relative overflow-hidden border-b border-site-border bg-gradient-to-b from-site-card to-[var(--site-bg)] flex-shrink-0 w-full">
      {hasBanner && bannerSrc ? (
        <div className="relative min-h-[240px] md:min-h-[420px] flex flex-col items-center justify-center py-6 md:py-12 w-full">
          <div className="absolute inset-0">
            <Image
              src={bannerSrc}
              alt="히어로 배너"
              fill
              className="object-cover pointer-events-none"
              sizes="100vw"
              unoptimized={bannerSrc.startsWith("data:")}
            />
          </div>
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          <div className="relative z-10 w-full flex flex-col items-center justify-center px-4 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            {content}
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(214,40,40,0.08),transparent)] pointer-events-none" />
          <div className="relative z-10 min-h-[240px] md:min-h-[420px] w-full flex flex-col items-center justify-center py-6 md:py-12 flex-shrink-0">
            {content}
          </div>
        </>
      )}
    </section>
  );
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

  const buttonsBlock = enabledButtons.length > 0 ? (
    <div className={`flex w-full flex-wrap gap-3 sm:gap-4 ${buttonsAlignClass}`}>
      {enabledButtons.map((btn, i) => (
        <Link
          key={i}
          href={btn.href || "#"}
          target={btn.openInNewTab ? "_blank" : undefined}
          rel={btn.openInNewTab ? "noopener noreferrer" : undefined}
          className={`${buttonSizeClassNew(btn.size)} ${buttonVariantClassNew(btn.variant)}`}
        >
          {btn.label}
        </Link>
      ))}
    </div>
  ) : null;

  const textBlock = (
    <div className={`w-full ${textAlignClass}`} style={{ maxWidth: s.heroTextMaxWidth }}>
      {s.heroEyebrowText && (
        <p className="mb-1 text-white/90" style={{ fontSize: s.heroSubtitleSize }}>
          {s.heroEyebrowText}
        </p>
      )}
      <h1 className="font-bold leading-tight text-white" style={{ fontSize: s.heroTitleSize }}>
        {s.heroTitle || "CAROM.CLUB"}
      </h1>
      {s.heroSubtitle && (
        <p className="mt-1 text-white/95" style={{ fontSize: s.heroSubtitleSize }}>
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
    <div className={`relative z-10 flex w-full flex-1 flex-col px-4 py-6 ${justifyClass} ${itemsClass}`}>
      {textBlock}
      {s.heroButtonsPosition === "bottom" && <div className="mt-auto pt-6">{buttonsBlock}</div>}
    </div>
  );

  const mobileHeight = s.heroHeightMobile || "280px";
  const desktopHeight = s.heroHeightDesktop || "380px";

  return (
    <section className="hero-section-new relative overflow-hidden border-b border-site-border flex-shrink-0 w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `.hero-section-new{min-height:${mobileHeight}}@media(min-width:768px){.hero-section-new{min-height:${desktopHeight}}}.hero-block-new{position:absolute;inset:0;min-height:${mobileHeight}}@media(min-width:768px){.hero-block-new{min-height:${desktopHeight}}}`,
        }}
      />
      <div className="hero-block-new flex flex-col items-center py-10 sm:py-12 md:py-12 w-full">
        {hasBgImage && bgSrc ? (
          <div className="absolute inset-0">
            <Image
              src={bgSrc}
              alt="히어로 배경"
              fill
              className="object-cover pointer-events-none"
              sizes="100vw"
              unoptimized={bgSrc.startsWith("data:")}
              style={{
                filter: s.heroBlurAmount > 0 ? `blur(${s.heroBlurAmount}px)` : undefined,
              }}
            />
          </div>
        ) : null}
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
