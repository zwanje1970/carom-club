import { SiteFooter } from "@/components/layout/SiteFooter";
import type { SiteSettings } from "@/lib/site-settings";

/** 홈 하단 푸터(md 이상). 본문 블록은 전부 `PageRenderer` 슬롯에서 렌더한다. */
export function HomeDeferredFooterOnly({
  copy,
  siteSettings,
  isMobileRequest,
}: {
  copy: Record<string, string>;
  siteSettings: SiteSettings;
  isMobileRequest: boolean;
}) {
  const footer = siteSettings.footer;
  const enabledByDevice = isMobileRequest ? footer.footerMobileEnabled : footer.footerDesktopEnabled;
  if (!footer.footerEnabled || !enabledByDevice) return null;
  return (
    <SiteFooter
      footer={footer}
      defaultTagline={copy["site.footer.tagline"] ?? undefined}
    />
  );
}
