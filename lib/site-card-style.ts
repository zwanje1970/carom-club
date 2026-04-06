export type SiteCardStyle = {
  shape: "circle" | "square";
  width: number;
  height: number;
  style: "flat" | "border" | "shadow";
  thumbFit: "cover" | "contain";
  linkMode: "block" | "button";
  radius: number;
};

export const SITE_CARD_STYLE_COPY_KEYS = [
  "site.card.default.shape",
  "site.card.default.width",
  "site.card.default.height",
  "site.card.default.style",
  "site.card.default.thumbFit",
  "site.card.default.linkMode",
  "site.card.default.radius",
] as const;

export const DEFAULT_SITE_CARD_STYLE: SiteCardStyle = {
  shape: "square",
  width: 320,
  height: 180,
  style: "border",
  thumbFit: "cover",
  linkMode: "block",
  radius: 16,
};

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function parseSiteCardStyle(copy: Record<string, string>): SiteCardStyle {
  const shape = copy["site.card.default.shape"] === "circle" ? "circle" : "square";
  const style = (() => {
    const raw = copy["site.card.default.style"];
    if (raw === "flat" || raw === "border" || raw === "shadow") return raw;
    return DEFAULT_SITE_CARD_STYLE.style;
  })();
  const thumbFit = copy["site.card.default.thumbFit"] === "contain" ? "contain" : "cover";
  const linkMode = copy["site.card.default.linkMode"] === "button" ? "button" : "block";
  const width = clampNumber(Number(copy["site.card.default.width"]), 120, 1200, DEFAULT_SITE_CARD_STYLE.width);
  const height = clampNumber(Number(copy["site.card.default.height"]), 80, 1200, DEFAULT_SITE_CARD_STYLE.height);
  const radius = clampNumber(Number(copy["site.card.default.radius"]), 0, 999, DEFAULT_SITE_CARD_STYLE.radius);
  return { shape, width, height, style, thumbFit, linkMode, radius };
}

export function toSiteCardStyleCopy(style: SiteCardStyle): Record<string, string> {
  return {
    "site.card.default.shape": style.shape,
    "site.card.default.width": String(style.width),
    "site.card.default.height": String(style.height),
    "site.card.default.style": style.style,
    "site.card.default.thumbFit": style.thumbFit,
    "site.card.default.linkMode": style.linkMode,
    "site.card.default.radius": String(style.radius),
  };
}
