/**
 * 관리자(/admin) · 클라이언트(/client) 콘솔 공통 레이아웃 토큰
 *
 * 브레이크포인트 의미 (Tailwind 기본값)
 * - md (768px): 페이지 내부 콘텐츠 밀도·카드↔테이블 분기 (hidden md:block / md:hidden 등)
 * - lg (1024px): 좌측 사이드바 표시, 클라이언트 하단 탭 네비 숨김
 * - xl (1280px): 필요 시 보조 확장용 (현재 셸 본문 폭은 max-w-6xl로 고정)
 *
 * 768~1023px (md 이상, lg 미만)
 * - 사이드바 없음 · 상단 헤더/햄버거만
 * - 클라이언트: 하단 네비 표시, 본문 하단 safe-area 패딩 유지
 * - 목록/대시보드: md 기준 카드형 UI 유지 — 셸의 lg 사이드바와 역할이 겹치지 않음
 *
 * 본문 폭: 양 콘솔 모두 동일 컬럼 폭 max-w-6xl (1152px) + 좌우 패딩 공통
 */

/** 중앙 정렬 본문 컬럼 — max-width 72rem */
export const CONSOLE_INNER_MAX_CLASS = "mx-auto w-full min-w-0 max-w-6xl";

/** 셸 본문·헤더·푸터 공통 수평 패딩 */
export const CONSOLE_PAD_X_CLASS = "px-4 sm:px-5 md:px-6";

/** 관리자 스크롤 main 세로 패딩 */
export const CONSOLE_ADMIN_MAIN_PAD_Y_CLASS = "py-4 md:py-6";

/** 관리자 AdminLayout — 일반 페이지 main (에디터 풀폭 제외) */
export const CONSOLE_ADMIN_MAIN_CLASS = [
  CONSOLE_INNER_MAX_CLASS,
  CONSOLE_PAD_X_CLASS,
  CONSOLE_ADMIN_MAIN_PAD_Y_CLASS,
  "overflow-x-hidden",
].join(" ");

/** 클라이언트 스크롤 main — 하단 네비는 lg 미만에서만 고정 표시 */
export const CLIENT_CONSOLE_MAIN_SCROLL_CLASS = [
  CONSOLE_INNER_MAX_CLASS,
  CONSOLE_PAD_X_CLASS,
  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-zinc-100 dark:bg-zinc-950",
  "pt-4 md:pt-6",
  "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6",
].join(" ");

/** 클라이언트 상단 헤더 내부 — 본문 컬럼과 정렬 */
export const CLIENT_CONSOLE_HEADER_INNER_CLASS = [
  CONSOLE_INNER_MAX_CLASS,
  CONSOLE_PAD_X_CLASS,
  "flex min-h-12 w-full items-center justify-between gap-3",
].join(" ");
