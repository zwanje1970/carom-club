/**
 * 편집기·Hero 등에서 공통 사용하는 글꼴 크기 (숫자+px).
 * 당구장 홍보·Hero 글자 편집 툴에서 동일하게 사용.
 */
export const FONT_SIZES_PX = [
  "12px", "14px", "16px", "18px", "24px", "32px", "48px",
  "64px", "72px", "96px", "120px", "144px", "168px", "192px",
];

/**
 * 편집기·Hero 등에서 선택 가능한 글꼴.
 * 사이트에서 로드하는 웹폰트는 Pretendard·Noto Sans KR만 사용한다.
 * value는 CSS font-family 문자열.
 */
export const FONT_FAMILIES = [
  { label: "기본(상속)", value: "" },
  { label: "Pretendard", value: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif" },
  { label: "Noto Sans KR", value: '"Noto Sans KR", sans-serif' },
  { label: "system-ui", value: "system-ui, sans-serif" },
] as const;
