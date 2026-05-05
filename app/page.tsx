import type { Viewport } from "next";
import SitePublicChromeLayout from "./site/SitePublicChromeLayout";
import SiteHomePage, { metadata } from "./site/page";

export { metadata };

export const dynamic = "force-dynamic";

/** 루트 `/`도 `/site`와 동일한 공개 사이트 viewport(루트 layout은 다른 경로에 영향 주지 않도록 여기서만 지정) */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function HomePage() {
  return (
    <SitePublicChromeLayout>
      <SiteHomePage />
    </SitePublicChromeLayout>
  );
}
