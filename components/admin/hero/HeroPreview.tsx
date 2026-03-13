"use client";

import React from "react";

const HERO_PREVIEW_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200' viewBox='0 0 400 200'%3E%3Crect fill='%23e5e7eb' width='400' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='12'%3E%EB%B0%B0%EA%B2%BD%20%EC%9D%B4%EB%AF%B8%EC%A7%80%3C/text%3E%3C/svg%3E";

function buttonSizeClass(size: string | undefined): string {
  const base = "inline-flex items-center justify-center rounded-xl font-medium pointer-events-none";
  switch (size) {
    case "sm":
      return base + " min-h-[28px] px-2 py-1 text-[10px]";
    case "lg":
      return base + " min-h-[36px] px-4 py-2 text-xs";
    default:
      return base + " min-h-[32px] px-3 py-1.5 text-[11px]";
  }
}

type Props = {
  heroTitleHtml: string;
  titleAlign: string;
  btnPosition: string;
  btn1Label: string;
  btn2Label: string;
  btn1Size: string;
  btn2Size: string;
  backgroundImageUrl: string | null;
};

export function HeroPreview(props: Props) {
  const {
    heroTitleHtml,
    titleAlign,
    btnPosition,
    btn1Label,
    btn2Label,
    btn1Size,
    btn2Size,
    backgroundImageUrl,
  } = props;
  const hasBanner = !!backgroundImageUrl?.trim();
  const bgSrc = hasBanner ? backgroundImageUrl : HERO_PREVIEW_PLACEHOLDER;
  const alignClass =
    titleAlign === "left" ? "text-left" : titleAlign === "right" ? "text-right" : "text-center";
  const buttonsAbove = btnPosition === "above";

  const wrapperStyle = { minHeight: "200px" };
  const bgStyle = {
    minHeight: "200px",
    backgroundImage: "url(" + bgSrc + ")",
    imageRendering: "auto" as const,
  };
  const titleClassName =
    "hero-preview-content prose prose-p:my-0.5 max-w-none text-site-text [&_*]:text-inherit " +
    alignClass +
    (hasBanner ? " text-white [&_*]:text-inherit" : "");
  const titleStyle = { fontSize: "clamp(10px, 2.5vw, 14px)" };

  const btn1 = React.createElement(
    "span",
    { className: "rounded-lg bg-site-primary px-2 py-1 text-white " + buttonSizeClass(btn1Size) },
    btn1Label || "버튼1"
  );
  const btn2 = React.createElement(
    "span",
    {
      className:
        "rounded-lg border-2 border-site-primary bg-site-card text-site-primary " +
        buttonSizeClass(btn2Size),
    },
    btn2Label || "버튼2"
  );

  const buttonsRow = React.createElement(
    "div",
    { className: "flex flex-wrap items-center justify-center gap-1.5 sm:gap-2" },
    btn1,
    btn2
  );

  const inner = React.createElement(
    "div",
    {
      className:
        "relative z-10 flex min-h-[200px] w-full flex-col items-center justify-center px-3 py-4",
    },
    buttonsAbove ? buttonsRow : null,
    buttonsAbove ? React.createElement("div", { className: "mt-2" }) : null,
    React.createElement("div", {
      className: titleClassName,
      style: titleStyle,
      dangerouslySetInnerHTML: { __html: heroTitleHtml || "<p></p>" },
    }),
    !buttonsAbove ? React.createElement("div", { className: "mt-2" }) : null,
    !buttonsAbove ? buttonsRow : null
  );

  const overlay = hasBanner
    ? React.createElement("div", { className: "absolute inset-0 bg-black/40" })
    : null;

  const bgLayer = React.createElement(
    "div",
    { className: "relative w-full bg-cover bg-center", style: bgStyle },
    overlay,
    inner
  );

  return React.createElement(
    "div",
    {
      className:
        "rounded-lg overflow-hidden border border-site-border bg-site-card shadow-inner",
      style: wrapperStyle,
    },
    bgLayer
  );
}
