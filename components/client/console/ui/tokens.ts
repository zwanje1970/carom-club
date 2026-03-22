/**
 * 운영 콘솔 UI 토큰 — 메인 사이트 Tailwind와 섞이지 않도록 이 폴더에서만 사용.
 */
export const consoleBorder = "border border-zinc-300 dark:border-zinc-700";
export const consoleBorderT = "border-t border-zinc-300 dark:border-zinc-700";
export const consoleBorderB = "border-b border-zinc-300 dark:border-zinc-700";
/** 작은 반경만 사용 (카드형 둥근 모서리 지양) */
export const consoleRadius = "rounded-sm";
export const consoleSurface = "bg-white dark:bg-zinc-900";
export const consoleSurfaceMuted = "bg-zinc-50 dark:bg-zinc-900";
export const consoleTextTitle = "text-sm font-semibold text-zinc-900 dark:text-zinc-100";
export const consoleTextBody = "text-xs text-zinc-600 dark:text-zinc-400";
export const consoleTextMuted = "text-[11px] text-zinc-500 dark:text-zinc-500";
export const consoleFocusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500";

/** 기본 버튼 — 액션 바·헤더에서 공통 사용 */
export const consoleBtnPrimary =
  "inline-flex items-center justify-center border border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white " +
  consoleFocusRing;

export const consoleBtnSecondary =
  "inline-flex items-center justify-center border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 " +
  consoleFocusRing;

export const consoleBtnDanger =
  "inline-flex items-center justify-center border border-red-700 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-600 dark:bg-zinc-900 dark:text-red-200 dark:hover:bg-red-950/40 " +
  consoleFocusRing;

/** 필터·폼 인풋 래퍼에 붙이는 라벨 */
export const consoleLabelClass = "mb-0.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400";

export const consoleInputClass =
  "w-full min-w-[8rem] border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 " +
  consoleRadius +
  " " +
  consoleFocusRing;
