import "server-only";

import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const SOURCE_WIDTH = 440;
const SOURCE_HEIGHT = 180;
/** 레이아웃 계산은 기존 640 논리 좌표로 유지하고, 실제 PNG는 2x(1280)로 라스터화한다. */
const OUTPUT_WIDTH = 640;
const OUTPUT_HEIGHT = Math.round((OUTPUT_WIDTH * SOURCE_HEIGHT) / SOURCE_WIDTH);
const RASTER_WIDTH = 1280;
const SCALE = OUTPUT_WIDTH / SOURCE_WIDTH;
const CARD_FONT_FAMILY = "Noto Sans KR Variable";

export type TournamentPublishedCardImagePayload = {
  tournamentId: string;
  templateId?: string;
  title: string;
  subtitle?: string;
  textLine1?: string | null;
  textLine2?: string | null;
  textLine3?: string | null;
  statusBadge?: string | null;
  backgroundType?: "image" | "theme";
  themeType?: "dark" | "light" | "natural";
  backgroundImageUrl?: string | null;
  backgroundImageOpacity?: number | null;
  mediaBackground?: string | null;
  textShadowEnabled?: boolean | null;
  surfaceLayout?: "split" | "full";
  leadTextColor?: string | null;
  titleTextColor?: string | null;
  descriptionTextColor?: string | null;
  footerDateTextColor?: string | null;
  footerPlaceTextColor?: string | null;
};

const THEME_BACKGROUNDS: Record<"dark" | "light" | "natural", string> = {
  dark: "#0f2747",
  light: "#e0f2fe",
  natural: "#166534",
};

let bundledKoreanFontBuffers: Buffer[] | null = null;

function getBundledKoreanFontDir(): string {
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "node_modules",
    "@fontsource-variable",
    "noto-sans-kr",
    "files",
  );
}

/** resvg는 fontFiles 경로 로딩이 환경에 따라 실패할 수 있어, woff2 전체를 메모리에 적재한다. */
function getBundledKoreanFontBuffers(): Buffer[] {
  if (bundledKoreanFontBuffers) return bundledKoreanFontBuffers;
  const dir = getBundledKoreanFontDir();
  if (!existsSync(dir)) {
    throw new Error("Noto Sans KR font directory is missing.");
  }
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".woff2"))
    .map((name) => path.join(dir, name));
  if (files.length === 0) {
    throw new Error("Noto Sans KR font files are missing.");
  }
  bundledKoreanFontBuffers = files.map((filePath) => readFileSync(filePath));
  return bundledKoreanFontBuffers;
}

function esc(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clamp01(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  return Math.min(1, Math.max(0.15, n));
}

function normalizeColor(raw: unknown, fallback: string): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(s)) return s;
  if (/^rgba?\(/i.test(s)) return s;
  return fallback;
}

function parseSubtitle(subtitle: string): { dateText: string; placeText: string } {
  const parts = subtitle
    .split("·")
    .map((v) => v.trim())
    .filter(Boolean);
  if (parts.length === 0) return { dateText: "-", placeText: "-" };
  if (parts.length === 1) return { dateText: parts[0] || "-", placeText: "-" };
  return { dateText: parts[0] || "-", placeText: parts.slice(1).join(" · ") || "-" };
}

function textWidthWeight(raw: string): number {
  let out = 0;
  for (const ch of raw) {
    if (/\s/.test(ch)) out += 0.45;
    else if (/[\u3131-\uD79D]/.test(ch)) out += 1;
    else if (/[A-Z0-9]/.test(ch)) out += 0.72;
    else out += 0.58;
  }
  return out;
}

function wrapText(raw: string, maxWeight: number, maxLines: number): string[] {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (textWidthWeight(next) <= maxWeight || !cur) {
      cur = next;
      continue;
    }
    lines.push(cur);
    cur = word;
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && textWidthWeight(lines[lines.length - 1] ?? "") > maxWeight) {
    const last = lines[lines.length - 1] ?? "";
    let cut = "";
    for (const ch of last) {
      if (textWidthWeight(`${cut}${ch}…`) > maxWeight) break;
      cut += ch;
    }
    lines[lines.length - 1] = `${cut.trimEnd()}…`;
  }
  return lines;
}

function textBlock(params: {
  x: number;
  y: number;
  lines: string[];
  fontSize: number;
  fontWeight: number;
  color: string;
  lineHeight?: number;
  textAnchor?: "start" | "middle" | "end";
  shadow?: boolean;
}): string {
  const lineHeight = params.lineHeight ?? params.fontSize * 1.2;
  const anchor = params.textAnchor ?? "start";
  if (params.lines.length === 0) return "";
  const makeText = (dx: number, dy: number, fill: string, opacity?: number) => {
    const spans = params.lines
      .map((line, idx) => {
        const x = params.x + dx;
        if (idx === 0) {
          return `<tspan x="${x}" y="${params.y + dy}">${esc(line)}</tspan>`;
        }
        return `<tspan x="${x}" dy="${lineHeight}">${esc(line)}</tspan>`;
      })
      .join("");
    return `<text fill="${esc(fill)}" font-size="${params.fontSize}" font-weight="${params.fontWeight}" font-family="${CARD_FONT_FAMILY}" text-anchor="${anchor}"${opacity != null ? ` opacity="${opacity}"` : ""}>${spans}</text>`;
  };
  const shadow = params.shadow ? makeText(0, 2, "#000000", 0.5) : "";
  return `${shadow}${makeText(0, 0, params.color)}`;
}

function singleLineText(params: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAnchor?: "start" | "middle" | "end";
  shadow?: boolean;
}): string {
  return textBlock({
    x: params.x,
    y: params.y,
    lines: [params.text],
    fontSize: params.fontSize,
    fontWeight: params.fontWeight,
    color: params.color,
    textAnchor: params.textAnchor,
    shadow: params.shadow,
  });
}

export function getTournamentPublishedCardRendererDiagnostics(): {
  bundledKoreanFontFileCount: number;
} {
  return { bundledKoreanFontFileCount: getBundledKoreanFontBuffers().length };
}

function statusKind(raw: string): "recruiting" | "closing" | "full" | "live" | "ended" {
  const s = raw.trim();
  if (s === "진행중") return "live";
  if (s.includes("마감임박") || (s.includes("마감") && s.includes("임박"))) return "closing";
  if (s.includes("종료")) return "ended";
  if (s.includes("마감")) return "full";
  return "recruiting";
}

function statusLabel(raw: string): string[] {
  const kind = statusKind(raw);
  if (kind === "closing") return ["마감", "임박"];
  if (kind === "live") return ["진행중"];
  if (kind === "ended") return ["종료"];
  if (kind === "full") return ["마감"];
  return ["모집중"];
}

function statusBadgeSvg(raw: string): string {
  const badge = statusLabel(raw);
  const size = Math.round(2.85 * 16 * 1.1 * 1.2 * SCALE);
  const cx = OUTPUT_WIDTH - Math.round(12 * 1.2 * SCALE) - size / 2;
  const cy = Math.round(13 * 1.2 * SCALE) + size / 2;
  const r = size / 2 - 2;
  const kind = statusKind(raw);
  const gradientId = `badge-${kind}`;
  const fontSize = badge.length > 1 ? 18 : 20;
  const tspans =
    badge.length > 1
      ? badge
          .map((line, idx) => {
            if (idx === 0) return `<tspan x="${cx}" y="${cy - 3}">${esc(line)}</tspan>`;
            return `<tspan x="${cx}" dy="19">${esc(line)}</tspan>`;
          })
          .join("")
      : `<tspan x="${cx}" y="${cy + 7}">${esc(badge[0])}</tspan>`;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradientId})" stroke="#fff" stroke-width="3" filter="url(#badgeShadow)" />
    <text fill="#fafaf9" font-size="${fontSize}" font-weight="800" font-family="${CARD_FONT_FAMILY}" text-anchor="middle">${tspans}</text>
  `;
}

function assertPublishedCardSvgHasText(
  svg: string,
  payload: { title: string; subtitle?: string },
): void {
  if (!/<text[\s>]/.test(svg)) {
    throw new Error("Published card SVG text layer is missing.");
  }
  const title = payload.title.trim() || "(제목)";
  if (!svg.includes(esc(title))) {
    throw new Error("Published card SVG is missing title text.");
  }
  const { dateText, placeText } = parseSubtitle(payload.subtitle ?? "");
  if (!svg.includes(esc(dateText)) || !svg.includes(esc(placeText))) {
    throw new Error("Published card SVG is missing footer text.");
  }
}

function resolveThemeBackground(payload: TournamentPublishedCardImagePayload): string {
  const media = typeof payload.mediaBackground === "string" ? payload.mediaBackground.trim() : "";
  if (media) return media;
  const theme = payload.themeType === "light" || payload.themeType === "natural" ? payload.themeType : "dark";
  return THEME_BACKGROUNDS[theme];
}

async function imageUrlToDataUri(rawUrl: string | null | undefined, baseUrl: string): Promise<string | null> {
  const raw = (rawUrl ?? "").trim();
  if (!raw) return null;
  if (/^data:image\//i.test(raw)) return raw;
  let url: URL;
  try {
    url = raw.startsWith("/") ? new URL(raw, baseUrl) : new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function renderTournamentPublishedCardPng(params: {
  payload: TournamentPublishedCardImagePayload;
  requestBaseUrl: string;
}): Promise<Buffer> {
  const { payload } = params;
  const surfaceLayout = payload.surfaceLayout === "full" ? "full" : "split";
  const template = payload.templateId === "B" ? "B" : "A";
  const subtitle = parseSubtitle(payload.subtitle ?? "");
  const mediaHeight = surfaceLayout === "full" ? OUTPUT_HEIGHT : Math.round((140 / SOURCE_HEIGHT) * OUTPUT_HEIGHT);
  const footerHeight = OUTPUT_HEIGHT - mediaHeight;
  const bgColor = resolveThemeBackground(payload);
  const imageDataUri =
    payload.backgroundType === "image"
      ? await imageUrlToDataUri(payload.backgroundImageUrl, params.requestBaseUrl)
      : null;
  const requiredBgUrl = (payload.backgroundImageUrl ?? "").trim();
  if (payload.backgroundType === "image" && requiredBgUrl && !imageDataUri) {
    throw new Error("Published card background image could not be fetched for server render.");
  }
  const opacity = clamp01(payload.backgroundImageOpacity, 1);
  const leadColor = normalizeColor(payload.leadTextColor, "#ffffff");
  const titleColor = normalizeColor(payload.titleTextColor, "#ffe566");
  const descColor = normalizeColor(payload.descriptionTextColor, "#ffffff");
  const footerDateColor = normalizeColor(payload.footerDateTextColor, surfaceLayout === "full" ? "#f8fafc" : "#18181b");
  const footerPlaceColor = normalizeColor(payload.footerPlaceTextColor, surfaceLayout === "full" ? "#e2e8f0" : "#3f3f46");
  const lead = (payload.textLine1 ?? "").trim();
  const desc = (payload.textLine2 ?? "").trim();
  const desc2 = (payload.textLine3 ?? "").trim();
  const title = payload.title.trim() || "(제목)";
  const badgeSpace = 104;
  const left = template === "B" ? OUTPUT_WIDTH / 2 : 20;
  const textMax = template === "B" ? 30 : 34;
  const titleMax = template === "B" ? 20 : 24;
  const anchor = template === "B" ? "middle" : "start";
  const textShadow = payload.textShadowEnabled === true;

  let bodyText = "";
  if (template === "B") {
    const top = lead ? 60 : 71;
    bodyText += textBlock({
      x: left,
      y: top,
      lines: wrapText(lead, textMax, 1),
      fontSize: 20,
      fontWeight: 400,
      color: leadColor,
      textAnchor: anchor,
      shadow: textShadow,
    });
    bodyText += textBlock({
      x: left,
      y: lead ? top + 31 : top,
      lines: wrapText(title, titleMax, 2),
      fontSize: 29,
      fontWeight: 800,
      color: titleColor,
      lineHeight: 32,
      textAnchor: anchor,
      shadow: textShadow,
    });
    bodyText += textBlock({
      x: left,
      y: lead ? top + 93 : top + 64,
      lines: wrapText(desc, textMax, 2),
      fontSize: 19,
      fontWeight: 400,
      color: descColor,
      lineHeight: 24,
      textAnchor: anchor,
      shadow: textShadow,
    });
    bodyText += textBlock({
      x: left,
      y: lead ? top + 143 : top + 114,
      lines: wrapText(desc2, textMax, 1),
      fontSize: 19,
      fontWeight: 700,
      color: descColor,
      textAnchor: anchor,
      shadow: textShadow,
    });
  } else {
    bodyText += textBlock({
      x: left,
      y: 32,
      lines: wrapText(lead, textMax, 1),
      fontSize: 20,
      fontWeight: 400,
      color: leadColor,
      shadow: textShadow,
    });
    bodyText += textBlock({
      x: left,
      y: lead ? 66 : 44,
      lines: wrapText(title, titleMax, 2),
      fontSize: 29,
      fontWeight: 800,
      color: titleColor,
      lineHeight: 33,
      shadow: textShadow,
    });
    bodyText += textBlock({
      x: left,
      y: lead ? 130 : 109,
      lines: wrapText(desc, textMax, 2),
      fontSize: 19,
      fontWeight: 400,
      color: descColor,
      lineHeight: 24,
      shadow: textShadow,
    });
    bodyText += textBlock({
      x: left,
      y: lead ? 179 : 158,
      lines: wrapText(desc2, textMax - 2, 1),
      fontSize: 19,
      fontWeight: 700,
      color: descColor,
      shadow: textShadow,
    });
  }

  if (template === "A") {
    bodyText = `<g clip-path="url(#textClipA)">${bodyText}</g>`;
  } else {
    bodyText = `<g clip-path="url(#textClipB)">${bodyText}</g>`;
  }

  const footer =
    surfaceLayout === "split"
      ? `
        <rect x="0" y="${mediaHeight}" width="${OUTPUT_WIDTH}" height="${footerHeight}" fill="#fff" />
        ${singleLineText({ x: 18, y: mediaHeight + 36, text: subtitle.dateText, fontSize: 19, fontWeight: 400, color: footerDateColor, shadow: textShadow })}
        ${singleLineText({ x: OUTPUT_WIDTH - 18, y: mediaHeight + 36, text: subtitle.placeText, fontSize: 19, fontWeight: 400, color: footerPlaceColor, textAnchor: "end", shadow: textShadow })}
      `
      : `
        <rect x="0" y="${OUTPUT_HEIGHT - 44}" width="${OUTPUT_WIDTH}" height="44" fill="rgba(0,0,0,0.16)" />
        ${singleLineText({ x: 18, y: OUTPUT_HEIGHT - 17, text: subtitle.dateText, fontSize: 19, fontWeight: 400, color: footerDateColor, shadow: textShadow })}
        ${singleLineText({ x: OUTPUT_WIDTH - 18, y: OUTPUT_HEIGHT - 17, text: subtitle.placeText, fontSize: 19, fontWeight: 400, color: footerPlaceColor, textAnchor: "end", shadow: textShadow })}
      `;

  const imageLayer = imageDataUri
    ? `<image href="${imageDataUri}" x="0" y="0" width="${OUTPUT_WIDTH}" height="${mediaHeight}" preserveAspectRatio="xMidYMid slice" opacity="${opacity}" />`
    : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_WIDTH}" height="${OUTPUT_HEIGHT}" viewBox="0 0 ${OUTPUT_WIDTH} ${OUTPUT_HEIGHT}">
      <defs>
        <clipPath id="cardClip"><rect x="0" y="0" width="${OUTPUT_WIDTH}" height="${OUTPUT_HEIGHT}" rx="17" ry="17" /></clipPath>
        <clipPath id="textClipA"><rect x="16" y="18" width="${OUTPUT_WIDTH - 16 - badgeSpace}" height="${mediaHeight - 20}" /></clipPath>
        <clipPath id="textClipB"><rect x="48" y="18" width="${OUTPUT_WIDTH - badgeSpace - 84}" height="${mediaHeight - 20}" /></clipPath>
        <filter id="textShadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.45" /></filter>
        <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.35" /></filter>
        <linearGradient id="badge-recruiting" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" /><stop offset="100%" stop-color="#2563eb" /></linearGradient>
        <linearGradient id="badge-closing" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444" /><stop offset="100%" stop-color="#dc2626" /></linearGradient>
        <linearGradient id="badge-full" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" /><stop offset="100%" stop-color="#16a34a" /></linearGradient>
        <linearGradient id="badge-live" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6366f1" /><stop offset="100%" stop-color="#4f46e5" /></linearGradient>
        <linearGradient id="badge-ended" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#171717" /><stop offset="100%" stop-color="#0a0a0a" /></linearGradient>
      </defs>
      <g clip-path="url(#cardClip)">
        <rect x="0" y="0" width="${OUTPUT_WIDTH}" height="${mediaHeight}" fill="${esc(bgColor)}" />
        ${imageLayer}
        <rect x="0" y="0" width="${OUTPUT_WIDTH}" height="${mediaHeight}" fill="rgba(0,0,0,0.10)" />
        ${statusBadgeSvg(payload.statusBadge ?? "모집중")}
        ${bodyText}
        ${footer}
      </g>
    </svg>
  `;
  assertPublishedCardSvgHasText(svg, payload);

  type ResvgFontConfig = NonNullable<ConstructorParameters<typeof Resvg>[1]>["font"] & {
    fontBuffers?: Buffer[];
  };

  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: RASTER_WIDTH },
    font: {
      loadSystemFonts: false,
      fontBuffers: getBundledKoreanFontBuffers(),
      defaultFontFamily: "Noto Sans KR Variable",
      sansSerifFamily: "Noto Sans KR Variable",
    } as ResvgFontConfig,
  })
    .render()
    .asPng();

  const rasterized =
    (await sharp(rendered).metadata()).width === RASTER_WIDTH
      ? rendered
      : await sharp(rendered).resize({ width: RASTER_WIDTH, withoutEnlargement: false }).png().toBuffer();

  return sharp(rasterized).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}
