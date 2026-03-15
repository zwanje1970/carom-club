"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ZONE_TABS = [
  { href: "", label: "권역 정보" },
  { href: "/participants", label: "참가자" },
  { href: "/bracket", label: "대진표" },
  { href: "/results", label: "결과 관리" },
];

export function ZoneDetailTabs({ zoneId }: { zoneId: string }) {
  const pathname = usePathname();
  const base = `/zone/${zoneId}`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
      {ZONE_TABS.map((tab) => {
        const href = tab.href ? `${base}${tab.href}` : base;
        const isActive =
          href === pathname ||
          (tab.href !== "" && pathname?.startsWith(base + tab.href));
        return (
          <Link
            key={tab.href || "base"}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              isActive
                ? "bg-site-bg text-site-primary"
                : "text-gray-600 hover:bg-gray-100 hover:text-site-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-site-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
