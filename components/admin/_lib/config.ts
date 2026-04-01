/**
 * Admin One 레이아웃 설정
 * 본문 컬럼 폭·패딩은 `lib/console-layout.ts`와 통일
 */

import {
  CONSOLE_INNER_MAX_CLASS,
  CONSOLE_PAD_X_CLASS,
} from "@/lib/console-layout";

/** 레거시 이름 — 내용 컬럼 (max-w-6xl) */
export const containerMaxW = CONSOLE_INNER_MAX_CLASS;

export { CONSOLE_PAD_X_CLASS };

export const appTitle = "CAROM 관리자";

export function getPageTitle(pageTitle: string): string {
  return `${pageTitle} | ${appTitle}`;
}
