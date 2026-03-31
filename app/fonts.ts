import localFont from "next/font/local";

/**
 * Pretendard: 한글 서브셋 woff2 (Regular 400 + Bold 700).
 * 600 Semibold는 `public/fonts/pretendard-semibold-subset.woff2` 추가 후 src에 weight "600" 항목으로 확장.
 * app/(site)/layout.tsx 에서만 import (전역 루트에서는 import 금지).
 */
export const pretendard = localFont({
  src: [
    {
      path: "../public/fonts/pretendard-regular-subset.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/pretendard-bold-subset.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-pretendard",
  display: "swap",
  preload: true,
});
