"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function normalizedPathname(pathname: string | null): string {
  if (!pathname) return "/";
  const base = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (base.length > 1 && base.endsWith("/")) return base.slice(0, -1);
  return base;
}

export default function PlatformDashboardBackLink() {
  const pathname = normalizedPathname(usePathname());
  if (pathname === "/platform") return null;
  if (!pathname.startsWith("/platform/")) return null;

  return (
    <div
      style={{
        maxWidth: "48rem",
        margin: "0 auto",
        padding: "0.35rem 1rem 0",
      }}
    >
      <Link href="/platform" prefetch={false} className="secondary-button">
        대시보드로
      </Link>
    </div>
  );
}
