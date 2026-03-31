import { Noto_Sans_KR } from "next/font/google";

/**
 * 읽기·규정·홍보형 콘텐츠 전용 (app/(content)/* 레이아웃에서만 import).
 * 루트·(site) 레이아웃에서는 이 모듈을 import 하지 않는다.
 */
export const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});
