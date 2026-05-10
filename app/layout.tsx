import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import {
  CAROM_CLIENT_MOBILE_APP_SHELL_HEADER,
  CAROM_CLIENT_MOBILE_SHELL_BOOT_SCRIPT,
} from "../lib/carom-client-mobile-shell-boot";
import CaromClientMobileShellHtmlSync from "./components/CaromClientMobileShellHtmlSync";
import FcmSessionRegisterClient from "./components/FcmSessionRegisterClient";
import SiteGeoLifecycleGuard from "./components/SiteGeoLifecycleGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "캐롬클럽",
  description: "당구 대회·클럽·커뮤니티",
};

/** iOS 등에서 env(safe-area-inset-*)가 동작하도록 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shellFromProxy = (await headers()).get(CAROM_CLIENT_MOBILE_APP_SHELL_HEADER) === "1";

  return (
    <html
      lang="ko"
      suppressHydrationWarning
      {...(shellFromProxy ? { "data-mobile-app-shell": "1" as const } : {})}
    >
      <body>
        <Script id="carom-client-mobile-shell-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: CAROM_CLIENT_MOBILE_SHELL_BOOT_SCRIPT }} />
        <CaromClientMobileShellHtmlSync />
        <SiteGeoLifecycleGuard />
        <FcmSessionRegisterClient />
        {children}
      </body>
    </html>
  );
}
