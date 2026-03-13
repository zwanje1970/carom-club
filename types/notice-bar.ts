/**
 * 상단 공지 배너 타입 (CMS)
 * Neon DB 연결 시 테이블 구조 설계에 사용
 */

export type NoticeBarPageSlug = "all" | "home" | "venues" | "tournaments";

export interface NoticeBar {
  id: string;
  message: string;
  linkType: "none" | "internal" | "external";
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  backgroundColor: string;  // hex
  textColor: string;        // hex
  page: NoticeBarPageSlug;
  position: "below_header" | "fixed_top"; // 헤더 바로 아래 | 사이트 상단 고정
  startAt: string | null;   // ISO date
  endAt: string | null;     // ISO date
  isVisible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
