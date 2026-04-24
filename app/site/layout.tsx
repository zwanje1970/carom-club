import type { Viewport } from "next";
import SitePublicChromeLayout from "./SitePublicChromeLayout";

export const dynamic = "force-dynamic";

/** 공개 /site 전용: 핀치 줌·사용자 확대 비허용(루트 viewport와 병합). 플랫폼/클라이언트 레이아웃에는 적용되지 않음 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SitePublicChromeLayout>{children}</SitePublicChromeLayout>;
}
