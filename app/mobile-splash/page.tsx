import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isCaromClubMobileAppShell } from "../../lib/is-carom-club-mobile-app-shell";
import MobileAppSplashClient from "./MobileAppSplashClient";

export const dynamic = "force-dynamic";

/** 앱 WebView 전용 내부 스플래시 — 일반 브라우저는 메인으로 보냄 */
export default async function MobileSplashPage() {
  const h = await headers();
  if (!isCaromClubMobileAppShell(h)) {
    redirect("/");
  }
  return <MobileAppSplashClient />;
}
