import localFont from "next/font/local";

/**
 * Pretendard: 한글 서브셋 woff2 2개만 사용 (Regular + Bold).
 * 풀 정적(9가지 weight 등) 대비 용량 대폭 절감. variable 풀(약 2MB)은 배포 크기상 미사용.
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
