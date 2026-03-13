export function SiteThemeStyles({
  primaryColor,
  secondaryColor,
}: {
  primaryColor: string;
  secondaryColor: string;
}) {
  const primary = escapeCssValue(primaryColor);
  const secondary = escapeCssValue(secondaryColor);
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { --site-primary: ${primary}; --site-secondary: ${secondary}; }`,
      }}
    />
  );
}

function escapeCssValue(value: string): string {
  if (/^#[0-9A-Fa-f]{3,8}$/.test(value)) return value;
  return value.replace(/[^#0-9A-Za-z(),%.\s-]/, "");
}
