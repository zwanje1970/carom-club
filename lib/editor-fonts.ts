/**
 * 편집기·Hero 등에서 공통 사용하는 글꼴 크기 (숫자+px).
 * 당구장 홍보·Hero 글자 편집 툴에서 동일하게 사용.
 */
export const FONT_SIZES_PX = [
  "12px", "14px", "16px", "18px", "24px", "32px", "48px",
  "64px", "72px", "96px", "120px", "144px", "168px", "192px",
];

/**
 * 편집기·Hero 등에서 공통 사용하는 글꼴 목록.
 * value는 CSS font-family 값 (웹폰트/시스템 폰트명).
 */
export const FONT_FAMILIES = [
  { label: "기본", value: "" },
  { label: "굴림", value: "Gulim, 굴림, sans-serif" },
  { label: "돋움", value: "Dotum, 돋움, sans-serif" },
  { label: "명조", value: "Batang, 명조, serif" },
  { label: "Pretendard", value: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif" },
  { label: "Noto Sans KR", value: '"Noto Sans KR", sans-serif' },
  { label: "Nanum Gothic", value: '"Nanum Gothic", sans-serif' },
  { label: "Nanum Myeongjo", value: '"Nanum Myeongjo", serif' },
  { label: "Spoqa Han Sans Neo", value: '"Spoqa Han Sans Neo", sans-serif' },
  { label: "Black Han Sans", value: '"Black Han Sans", sans-serif' },
  { label: "Do Hyeon", value: '"Do Hyeon", sans-serif' },
  { label: "Gothic A1", value: '"Gothic A1", sans-serif' },
  { label: "IBM Plex Sans KR", value: '"IBM Plex Sans KR", sans-serif' },
] as const;
