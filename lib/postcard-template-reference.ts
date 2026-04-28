/**
 * 메인 슬라이드·게시카드 UI 기준값 — 외부 레퍼런스 프로젝트와 동기화한다.
 * @see C:/project/carom-postcard-template-test/src/App.tsx
 * @see C:/project/carom-postcard-template-test/src/components/SlideDeck.tsx
 */

/** `App.tsx` — CARD_TEXT_COLOR_SWATCHES (label 순서·hex 그대로) */
export const POSTCARD_TEMPLATE_TEXT_COLOR_SWATCHES = [
  "#0a0a0a",
  "#2563eb",
  "#dc2626",
  "#facc15",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#ffffff",
] as const;

/**
 * `App.tsx` — 편집기 useState 초기값.
 * 대회 요약/일정이 비었을 때 게시카드 작성 폼의 기본 문구로 사용한다.
 * (제품 기본값 — 임의 삭제·비워 두지 말 것.)
 */
export const POSTCARD_TEMPLATE_APP_DEFAULTS = {
  leadText: "전국 오픈 · 클럽 리그",
  title: "제2회 전국당구대회",
  descriptionText: "클럽 회원 및 게스트 참가 가능 · 상세 일정은 공지 참고",
  dateText: "2026. 06. 18 (일)",
  placeText: "캐롬클럽 빌리어즈",
} as const;

/** `SlideDeck.tsx` — SLIDE_SAMPLES[0] (슬라이드 덱 첫 장 샘플) */
export const POSTCARD_TEMPLATE_SLIDE_DECK_FIRST_SAMPLE = {
  statusBadge: "모집중",
  leadText: "전국 오픈 · 클럽 리그",
  title: "제2회 전국당구대회",
  descriptionText: "클럽 회원 및 게스트 참가 가능",
  dateText: "2026. 05. 18 (토)",
  placeText: "캐롬클럽 빌리어즈",
} as const;
