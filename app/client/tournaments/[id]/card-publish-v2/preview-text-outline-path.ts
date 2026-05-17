"use client";

import { parse as parseOpenType } from "opentype.js/dist/opentype.mjs";

const OUTLINE_FONT_PUBLIC_URL = "/card-fonts/Pretendard-Regular.otf";

type OpenTypeFont = {
  unitsPerEm: number;
  ascender: number;
  getAdvanceWidth: (text: string, fontSize: number, options?: { kerning?: boolean }) => number;
  getPath: (
    text: string,
    x: number,
    y: number,
    fontSize: number,
    options?: { kerning?: boolean },
  ) => {
    toPathData: (decimalPlaces?: number) => string;
  };
};

type OutlineSnapshot = {
  text: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  letterSpacing: string;
  lineHeight: number;
  fill: string;
  textAnchor: "start" | "middle" | "end";
  stroke: string;
  strokeWidth: number;
  paintOrder?: "stroke fill";
};

let cachedFontPromise: Promise<OpenTypeFont | null> | null = null;

const ENABLE_PATH_LAYER_CHECK_LOG = process.env.NODE_ENV !== "production";

function logCardPathLayerCheck(message: string, payload?: Record<string, unknown>): void {
  if (!ENABLE_PATH_LAYER_CHECK_LOG) return;
  if (payload) {
    console.info("[card-path-layer-check]", message, payload);
    return;
  }
  console.info("[card-path-layer-check]", message);
}

function isHtmlTextNodeVisible(node: HTMLElement): boolean {
  const style = window.getComputedStyle(node);
  if (style.visibility === "hidden") return false;
  if (style.display === "none") return false;
  if (Number.parseFloat(style.opacity || "1") <= 0) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function parseLineHeightPx(raw: string, fontSize: number): number {
  if (raw === "normal") return Math.round(fontSize * 1.2);
  const n = Number.parseFloat(raw.replace("px", "").trim());
  if (!Number.isFinite(n) || n <= 0) return Math.round(fontSize * 1.2);
  return n;
}

function toAnchor(textAlign: string): "start" | "middle" | "end" {
  if (textAlign === "right" || textAlign === "end") return "end";
  if (textAlign === "center") return "middle";
  return "start";
}

async function loadOutlineFont(): Promise<OpenTypeFont | null> {
  if (!cachedFontPromise) {
    cachedFontPromise = (async () => {
      try {
        const response = await fetch(OUTLINE_FONT_PUBLIC_URL);
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        const parsed = parseOpenType(buffer) as unknown as OpenTypeFont;
        return parsed;
      } catch {
        return null;
      }
    })();
  }
  return cachedFontPromise;
}

function extractOutlineSnapshots(cardRoot: HTMLElement): OutlineSnapshot[] {
  const cardRect = cardRoot.getBoundingClientRect();
  const nodes = Array.from(cardRoot.querySelectorAll<HTMLElement>('[data-outline-content-item="1"]'));
  const mapped = nodes.map<OutlineSnapshot | null>((node) => {
      const text = (node.innerText || node.textContent || "").trim();
      if (!text) return null;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const fontSize = Number.parseFloat(style.fontSize.replace("px", "").trim());
      const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 14;
      const lineHeight = parseLineHeightPx(style.lineHeight, safeFontSize);
      const anchor = toAnchor(style.textAlign);
      const x =
        anchor === "end"
          ? rect.right - cardRect.left
          : anchor === "middle"
            ? rect.left - cardRect.left + rect.width / 2
            : rect.left - cardRect.left;
      const y = rect.top - cardRect.top;
      const titleOutlineEnabled = node.dataset.titleOutlineEnabled === "1";
      const titleOutlineColor = node.dataset.titleOutlineColor === "white" ? "#ffffff" : "#000000";
      return {
        text,
        x,
        y,
        fontFamily: style.fontFamily,
        fontSize: safeFontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        letterSpacing: style.letterSpacing,
        lineHeight,
        fill: style.color,
        textAnchor: anchor,
        stroke: titleOutlineEnabled ? titleOutlineColor : "none",
        strokeWidth: titleOutlineEnabled ? 1.2 : 0,
        paintOrder: titleOutlineEnabled ? ("stroke fill" as const) : undefined,
      } satisfies OutlineSnapshot;
    });
  return mapped.filter((v): v is OutlineSnapshot => v !== null);
}

function buildPathLayerSvg(cardRoot: HTMLElement, font: OpenTypeFont, items: OutlineSnapshot[]): SVGSVGElement {
  const rect = cardRoot.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * 1000) / 1000);
  const height = Math.max(1, Math.round(rect.height * 1000) / 1000);
  const unitsPerEm = font.unitsPerEm || 1000;
  const ascender = font.ascender || Math.round(unitsPerEm * 0.8);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("data-card-outline-path-layer", "1");
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";
  svg.style.zIndex = "6";
  svg.style.overflow = "visible";

  for (const item of items) {
    const lines = item.text.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      const sourceLine = line || " ";
      const widthPx = font.getAdvanceWidth(sourceLine, item.fontSize, { kerning: true });
      const xShift = item.textAnchor === "end" ? -widthPx : item.textAnchor === "middle" ? -(widthPx / 2) : 0;
      const baselineY = item.y + item.lineHeight * lineIndex + (ascender / unitsPerEm) * item.fontSize;
      const pathData = font.getPath(sourceLine, item.x + xShift, baselineY, item.fontSize, { kerning: true }).toPathData(3);
      if (!pathData.trim()) return;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", item.fill);
      path.setAttribute("stroke", item.stroke);
      path.setAttribute("stroke-width", `${item.strokeWidth}`);
      if (item.paintOrder) path.setAttribute("paint-order", item.paintOrder);
      svg.appendChild(path);
    });
  }
  return svg;
}

export async function withCardPreviewTextPathLayer(args: {
  previewCaptureRoot: HTMLElement;
  run: () => Promise<void>;
}): Promise<void> {
  logCardPathLayerCheck("captureRoot-ready", {
    hasCaptureRoot: args.previewCaptureRoot instanceof HTMLElement,
  });
  const cardRoot = args.previewCaptureRoot.querySelector('[data-tournament-card-capture-root="1"]') as HTMLElement | null;
  if (!(cardRoot instanceof HTMLElement)) {
    logCardPathLayerCheck("cardRoot-missing");
    await args.run();
    return;
  }

  const font = await loadOutlineFont();
  if (!font) {
    await args.run();
    return;
  }

  const textItems = extractOutlineSnapshots(cardRoot);
  if (textItems.length === 0) {
    logCardPathLayerCheck("outline-items-empty");
    await args.run();
    return;
  }

  const pathSvg = buildPathLayerSvg(cardRoot, font, textItems);
  const hiddenNodes: Array<{ node: HTMLElement; prevVisibility: string }> = [];
  const textNodes = Array.from(cardRoot.querySelectorAll<HTMLElement>('[data-outline-content-item="1"]'));
  logCardPathLayerCheck("before-hide", {
    contentItems: textNodes.length,
  });
  textNodes.forEach((node) => {
    hiddenNodes.push({ node, prevVisibility: node.style.visibility });
    node.style.visibility = "hidden";
  });
  const notHidden = textNodes
    .map((node) => {
      const style = window.getComputedStyle(node);
      if (style.visibility === "hidden") return null;
      const label =
        node.dataset.tournamentCardOverlay ||
        node.dataset.tournamentCardLabel ||
        node.className ||
        (node.textContent ?? "").slice(0, 18);
      return String(label || "unknown");
    })
    .filter((v): v is string => Boolean(v));
  const styleSamples = textNodes.slice(0, 6).map((node, idx) => {
    const style = window.getComputedStyle(node);
    return {
      index: idx,
      label:
        node.dataset.tournamentCardOverlay ||
        node.dataset.tournamentCardLabel ||
        (node.textContent ?? "").slice(0, 18),
      visibility: style.visibility,
      display: style.display,
      opacity: style.opacity,
    };
  });
  logCardPathLayerCheck("after-hide", {
    contentItems: textNodes.length,
    hiddenItems: textNodes.length - notHidden.length,
    notHidden,
    styleSamples,
  });

  cardRoot.style.position ||= "relative";
  cardRoot.appendChild(pathSvg);
  const svgPathCount = pathSvg.querySelectorAll("path").length;
  const visibleHtmlTextNodes = textNodes.filter((node) => isHtmlTextNodeVisible(node));
  const remaining = visibleHtmlTextNodes
    .map((node) => {
      const label =
        node.dataset.tournamentCardOverlay ||
        node.dataset.tournamentCardLabel ||
        node.className ||
        (node.textContent ?? "").slice(0, 18);
      return String(label || "unknown");
    })
    .filter((v, i, arr) => arr.indexOf(v) === i);
  logCardPathLayerCheck("capture-before-run", {
    contentItems: textNodes.length,
    hiddenItems: textNodes.length - notHidden.length,
    notHidden,
    visibleHtmlTextNodes: visibleHtmlTextNodes.length,
    remaining,
    hasSvgInCardRoot: cardRoot.contains(pathSvg),
    svgPathCount,
  });
  try {
    await args.run();
  } finally {
    pathSvg.remove();
    hiddenNodes.forEach(({ node, prevVisibility }) => {
      node.style.visibility = prevVisibility;
    });
    const restoredNotVisible = textNodes
      .filter((node) => window.getComputedStyle(node).visibility === "hidden")
      .map((node) => {
        const label =
          node.dataset.tournamentCardOverlay ||
          node.dataset.tournamentCardLabel ||
          node.className ||
          (node.textContent ?? "").slice(0, 18);
        return String(label || "unknown");
      });
    logCardPathLayerCheck("capture-finally-restored", {
      svgRemoved: !cardRoot.contains(pathSvg),
      restoredHiddenCount: textNodes.length - restoredNotVisible.length,
      stillHidden: restoredNotVisible,
    });
  }
}

