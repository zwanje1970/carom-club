/**
 * Admin One 레이아웃 설정
 */

export const containerMaxW = "xl:max-w-7xl xl:mx-auto";

export const appTitle = "CAROM 관리자";

export function getPageTitle(pageTitle: string): string {
  return `${pageTitle} | ${appTitle}`;
}
