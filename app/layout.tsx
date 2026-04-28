import type { Metadata, Viewport } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SiteGeoLifecycleGuard />
        <FcmSessionRegisterClient />
        {children}
      </body>
    </html>
  );
}
