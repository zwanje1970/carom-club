/**
 * 팝업 공지 콘텐츠 타입 (CMS)
 * Neon DB 연결 시 테이블 구조 설계에 사용
 */

export type PopupPageSlug = "all" | "home" | "venues" | "tournaments" | "community";

export interface Popup {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  buttonName: string | null;
  buttonLink: string | null;
  page: PopupPageSlug;
  startAt: string | null; // ISO date
  endAt: string | null;   // ISO date
  hideForTodayEnabled: boolean;  // 오늘 하루 보지 않기
  showCloseButton: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
