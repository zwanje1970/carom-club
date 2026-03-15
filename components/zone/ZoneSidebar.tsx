"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ZoneSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col shrink-0 border-r border-site-border bg-site-card text-site-text">
      <div className="p-4 border-b border-site-border">
        <Link href="/zone" className="font-bold text-site-text">
          권역 운영
        </Link>
      </div>
      <nav className="p-2">
        <Link
          href="/zone"
          className={`block rounded-lg px-3 py-2 text-sm hover:bg-site-bg hover:text-site-primary ${
            pathname === "/zone" ? "bg-site-bg text-site-primary font-medium" : "text-site-text"
          }`}
        >
          내가 맡은 권역
        </Link>
      </nav>
      <div className="mt-auto p-2 border-t border-site-border">
        <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-site-primary">
          메인으로
        </Link>
      </div>
    </aside>
  );
}
