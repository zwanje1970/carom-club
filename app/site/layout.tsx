import type { Viewport } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import SiteGeoConsentUrlSanitizer from "./components/SiteGeoConsentUrlSanitizer";
import SiteMypageLightChromeLayout from "./SiteMypageLightChromeLayout";
import SitePublicChromeLayout from "./SitePublicChromeLayout";
import { isPublicSiteMypageAreaPathname } from "./lib/site-root-swipe-order";

/** 공개 /site 전용: 핀치 줌·사용자 확대 비허용(루트 viewport와 병합). 플랫폼/클라이언트 레이아웃에는 적용되지 않음 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

function docPathnameFromNextLikeHeader(nextUrlHeader: string): string {
  const raw = nextUrlHeader.trim();
  if (!raw) return "";
  try {
    return raw.startsWith("http") ? new URL(raw).pathname : raw.split("?")[0] ?? raw;
  } catch {
    return raw.split("?")[0] ?? "";
  }
}

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const nextLike =
    headerList.get("next-url") ??
    headerList.get("x-invoke-path") ??
    headerList.get("x-matched-path") ??
    "";
  const isMypageArea = isPublicSiteMypageAreaPathname(docPathnameFromNextLikeHeader(nextLike));

  return (
    <>
      {isMypageArea ? (
        <SiteMypageLightChromeLayout>
          <Suspense fallback={null}>
            <SiteGeoConsentUrlSanitizer />
          </Suspense>
          {children}
        </SiteMypageLightChromeLayout>
      ) : (
        <SitePublicChromeLayout>
          <Suspense fallback={null}>
            <SiteGeoConsentUrlSanitizer />
          </Suspense>
          {children}
        </SitePublicChromeLayout>
      )}
    </>
  );
}
