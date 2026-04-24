import type { Metadata, Viewport } from "next";
import AdminDashboardFloatingFab from "./components/AdminDashboardFloatingFab";
import "./globals.css";

export const metadata: Metadata = {
  title: "V3 Structure Skeleton",
  description: "Site / client / platform structure only",
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
        {children}
        <AdminDashboardFloatingFab />
      </body>
    </html>
  );
}
