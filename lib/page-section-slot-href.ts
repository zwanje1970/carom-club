import type { PageSection } from "@/types/page-section";

/**
 * 페이지 빌더 `PageSection` 행의 링크 필드 → 내비게이션 href.
 * - `linkType`·`internalPath`·`internalPage`·`externalUrl`·첫 버튼 `href` 순으로 시도.
 * - 비어 있으면 null (호출측에서 copy 기본 경로로 보완).
 */
export function resolvePageSectionLinkHref(section: PageSection): string | null {
  const lt = section.linkType;
  if (lt === "external") {
    const u = section.externalUrl?.trim();
    return u || null;
  }
  if (lt === "internal") {
    const p = section.internalPath?.trim();
    if (p) {
      if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/")) return p;
      return `/${p}`;
    }
    const ip = section.internalPage;
    if (ip === "home") return "/";
    if (ip === "venues") return "/venues";
    if (ip === "tournaments") return "/tournaments";
    if (ip === "community") return "/community";
    if (ip === "mypage") return "/mypage";
    if (ip === "login") return "/login";
    if (ip === "signup") return "/signup";
  }
  const buttons = section.buttons;
  if (Array.isArray(buttons) && buttons.length > 0) {
    const primary = buttons.find((b) => b.isPrimary) ?? buttons[0];
    const bh = primary?.href?.trim();
    if (bh) return bh;
  }
  return null;
}
