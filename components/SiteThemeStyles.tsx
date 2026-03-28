export function SiteThemeStyles({
  primaryColor,
  secondaryColor,
  headerBgColor,
  headerTextColor,
  headerActiveColor,
}: {
  primaryColor: string;
  secondaryColor: string;
  headerBgColor?: string | null;
  headerTextColor?: string | null;
  headerActiveColor?: string | null;
}) {
  const primary = escapeCssValue(primaryColor);
  const secondary = escapeCssValue(secondaryColor);
  const hb = headerBgColor ? escapeCssValue(headerBgColor) : "#0a0a0a";
  const ht = headerTextColor ? escapeCssValue(headerTextColor) : "#d1d5db";
  const ha = headerActiveColor ? escapeCssValue(headerActiveColor) : "#fbbf24";
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { --site-primary: ${primary}; --site-secondary: ${secondary}; --site-header-bg: ${hb}; --site-header-text: ${ht}; --site-header-active: ${ha}; }`,
      }}
    />
  );
}

function escapeCssValue(value: string): string {
  if (/^#[0-9A-Fa-f]{3,8}$/.test(value)) return value;
  return value.replace(/[^#0-9A-Za-z(),%.\s-]/, "");
}
