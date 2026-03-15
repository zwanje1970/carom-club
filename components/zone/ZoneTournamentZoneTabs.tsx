"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "개요" },
  { href: "/participants", label: "참가자" },
  { href: "/bracket", label: "대진표" },
  { href: "/results", label: "결과 입력" },
];

export function ZoneTournamentZoneTabs({ tzId }: { tzId: string }) {
  const pathname = usePathname();
  const base = `/zone/tournament-zones/${tzId}`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-site-border pb-2">
      {TABS.map((tab) => {
        const href = tab.href ? `${base}${tab.href}` : base;
        const isActive =
          href === pathname || (tab.href !== "" && pathname?.startsWith(base + tab.href));
        return (
          <Link
            key={tab.href || "base"}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              isActive
                ? "bg-site-bg text-site-primary"
                : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
