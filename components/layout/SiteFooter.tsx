import Link from "next/link";
import { LogoLink } from "@/components/intro/LogoLink";
import type { FooterSettings, FooterFontSize, FooterItemFontSizeKey } from "@/lib/footer-settings";
import { getFooterFontFamilyCss } from "@/lib/footer-settings";

const FOOTER_FONT_SIZE_CSS: Record<FooterFontSize, string> = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
};

function itemFontSize(
  baseFontSize: string,
  fontSizes: FooterSettings["footerFontSizes"],
  key: FooterItemFontSizeKey
): string {
  const size = fontSizes[key];
  return size && FOOTER_FONT_SIZE_CSS[size] ? FOOTER_FONT_SIZE_CSS[size] : baseFontSize;
}

function itemStyle(
  baseFontSize: string,
  footer: FooterSettings,
  key: FooterItemFontSizeKey,
  color: string
): React.CSSProperties {
  return {
    color,
    fontSize: itemFontSize(baseFontSize, footer.footerFontSizes, key),
    fontFamily: getFooterFontFamilyCss(footer.footerFontFamilies?.[key]),
  };
}

type SiteFooterProps = {
  footer: FooterSettings;
  /** 푸터 비활성 시 또는 보조 문구용 (예: copy["site.footer.tagline"]) */
  defaultTagline?: string;
};

/** 보조 텍스트/링크 색: 배경 대비 가독성 유지 */
function mutedColor(textColor: string): string {
  if (!textColor) return "rgba(255,255,255,0.75)";
  if (textColor.startsWith("#")) {
    const hex = textColor.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},0.85)`;
  }
  return "rgba(255,255,255,0.85)";
}

export function SiteFooter({ footer, defaultTagline }: SiteFooterProps) {
  const bg = footer.footerEnabled && footer.footerBgColor
    ? footer.footerBgColor
    : "var(--site-card, #1a1a2e)";
  const text = footer.footerEnabled && footer.footerTextColor
    ? footer.footerTextColor
    : "var(--site-text-muted, #9ca3af)";
  const fontSize =
    footer.footerFontSize && FOOTER_FONT_SIZE_CSS[footer.footerFontSize]
      ? FOOTER_FONT_SIZE_CSS[footer.footerFontSize]
      : "0.875rem";
  const linkStyle = { color: text, opacity: 0.9 };
  const muted = mutedColor(text);

  if (!footer.footerEnabled) {
    return (
      <footer
        className="border-t border-site-border py-8"
        style={{ backgroundColor: bg, color: text, fontSize }}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex justify-center">
            <div className="scale-[0.8] origin-center">
              <LogoLink variant="footer" />
            </div>
          </div>
          <p className="mt-2 text-center text-sm" style={{ color: muted }}>
            {defaultTagline ?? "캐롬클럽 · 당구장 홍보 · 대회 신청"}
          </p>
        </div>
      </footer>
    );
  }

  const hasCompany =
    footer.footerTitle ||
    footer.footerCompanyName ||
    footer.footerBusinessNumber ||
    footer.footerCeoName ||
    footer.footerAddress ||
    footer.footerPhone ||
    footer.footerEmail;
  const partners = footer.footerPartners
    .filter((p) => p.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <footer
      className="border-t border-site-border py-8"
      style={{ backgroundColor: bg, color: text, fontSize }}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* 좌측: 주관사 정보 */}
          <div className="space-y-2">
            {footer.footerTitle && (
              <p className="font-semibold" style={itemStyle(fontSize, footer, "title", text)}>
                {footer.footerTitle}
              </p>
            )}
            {footer.footerCompanyName && (
              <p style={itemStyle(fontSize, footer, "companyName", muted)}>{footer.footerCompanyName}</p>
            )}
            {footer.footerBusinessNumber && (
              <p style={itemStyle(fontSize, footer, "businessNumber", muted)}>사업자등록번호 {footer.footerBusinessNumber}</p>
            )}
            {footer.footerCeoName && (
              <p style={itemStyle(fontSize, footer, "ceoName", muted)}>대표 {footer.footerCeoName}</p>
            )}
            {footer.footerAddress && (
              <p style={itemStyle(fontSize, footer, "address", muted)}>{footer.footerAddress}</p>
            )}
            {footer.footerPhone && (
              <p style={itemStyle(fontSize, footer, "phone", muted)}>
                연락처{" "}
                <a href={`tel:${footer.footerPhone}`} style={linkStyle} className="hover:underline">
                  {footer.footerPhone}
                </a>
              </p>
            )}
            {footer.footerEmail && (
              <p style={itemStyle(fontSize, footer, "email", muted)}>
                이메일{" "}
                <a href={`mailto:${footer.footerEmail}`} style={linkStyle} className="hover:underline">
                  {footer.footerEmail}
                </a>
              </p>
            )}
            {!hasCompany && (
              <div className="flex justify-center md:justify-start">
                <div className="scale-[0.8] origin-center">
                  <LogoLink variant="footer" />
                </div>
              </div>
            )}
          </div>

          {/* 우측: 협력업체 */}
          {partners.length > 0 && (
            <div className="flex flex-col items-center md:items-end">
              <p className="text-xs mb-2" style={{ color: muted }}>
                협력업체
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
                {partners.map((p) => {
                  const content = p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.logoUrl}
                      alt={p.name}
                      className="max-h-10 max-w-[120px] object-contain opacity-90 hover:opacity-100"
                    />
                  ) : (
                    <span className="text-sm" style={{ color: muted }}>
                      {p.name || "—"}
                    </span>
                  );
                  const wrap = p.websiteUrl ? (
                    <Link
                      href={p.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                      style={linkStyle}
                      aria-label={
                        p.name
                          ? `${p.name} 공식 웹사이트(새 창)`
                          : "협력업체 웹사이트(새 창)"
                      }
                    >
                      {content}
                    </Link>
                  ) : (
                    <span className="flex items-center">{content}</span>
                  );
                  return <div key={p.id}>{wrap}</div>;
                })}
              </div>
            </div>
          )}
        </div>

        {/* 하단 문구 */}
        {(footer.footerCopyright || defaultTagline) && (
          <p className="mt-6 pt-4 border-t border-white/10 text-center" style={itemStyle(fontSize, footer, "copyright", muted)}>
            {footer.footerCopyright || defaultTagline}
          </p>
        )}
      </div>
    </footer>
  );
}
