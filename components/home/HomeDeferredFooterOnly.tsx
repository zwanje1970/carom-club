import { SiteFooter } from "@/components/layout/SiteFooter";
import type { SiteSettings } from "@/lib/site-settings";

/** 홈 하단 푸터(md 이상). 본문 블록은 전부 `PageRenderer` 슬롯에서 렌더한다. */
export function HomeDeferredFooterOnly({
  copy,
  siteSettings,
}: {
  copy: Record<string, string>;
  siteSettings: SiteSettings;
}) {
  return (
    <div className="hidden md:block">
      <SiteFooter
        footer={siteSettings.footer}
        defaultTagline={copy["site.footer.tagline"] ?? undefined}
      />
    </div>
  );
}
