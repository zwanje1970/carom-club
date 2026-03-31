import type { SiteThemeCssTokens } from "@/lib/site-color-themes";

export function SiteThemeStyles({
  tokens,
  headerBgColor,
  headerTextColor,
  headerActiveColor,
}: {
  tokens: SiteThemeCssTokens;
  headerBgColor?: string | null;
  headerTextColor?: string | null;
  headerActiveColor?: string | null;
}) {
  const p = escapeCssValue(tokens.primary);
  const s = escapeCssValue(tokens.secondary);
  const bg = escapeCssValue(tokens.bg);
  const card = escapeCssValue(tokens.card);
  const text = escapeCssValue(tokens.text);
  const muted = escapeCssValue(tokens.textMuted);
  const border = escapeCssValue(tokens.border);
  const hb = headerBgColor ? escapeCssValue(headerBgColor) : "#0a0a0a";
  const ht = headerTextColor ? escapeCssValue(headerTextColor) : "#d1d5db";
  const ha = headerActiveColor ? escapeCssValue(headerActiveColor) : "#fbbf24";
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root {
  --site-primary: ${p};
  --site-secondary: ${s};
  --site-bg: ${bg};
  --site-card: ${card};
  --site-text: ${text};
  --site-text-muted: ${muted};
  --site-border: ${border};
  --color-primary: ${p};
  --color-secondary: ${s};
  --color-background: ${bg};
  --color-surface: ${card};
  --color-text: ${text};
  --color-muted: ${muted};
  --site-header-bg: ${hb};
  --site-header-text: ${ht};
  --site-header-active: ${ha};
}
body { color: var(--site-text); }`,
      }}
    />
  );
}

function escapeCssValue(value: string): string {
  if (/^#[0-9A-Fa-f]{3,8}$/.test(value)) return value;
  return value.replace(/[^#0-9A-Za-z(),%.\s-]/, "");
}
