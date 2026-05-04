import type { Viewport } from "next";
import PlatformSessionOnceClient from "./PlatformSessionOnceClient";
import "./platform-dashboard.css";

export const viewport: Viewport = {
  themeColor: "#4d7db5",
};

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <PlatformSessionOnceClient />
      {children}
    </div>
  );
}
