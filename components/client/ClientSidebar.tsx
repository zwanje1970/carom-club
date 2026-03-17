"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

const MENU_KEYS: { href: string; copyKey: AdminCopyKey }[] = [
  { href: "/client/dashboard", copyKey: "client.sidebar.dashboard" },
  { href: "/client/tournaments", copyKey: "client.sidebar.myTournaments" },
  { href: "/client/participants", copyKey: "client.sidebar.participants" },
  { href: "/client/zones", copyKey: "client.sidebar.zones" },
  { href: "/client/brackets", copyKey: "client.sidebar.brackets" },
  { href: "/client/results", copyKey: "client.sidebar.results" },
  { href: "/client/co-admins", copyKey: "client.sidebar.coAdmins" },
  { href: "/client/promo", copyKey: "client.sidebar.promo" },
  { href: "/client/setup", copyKey: "client.sidebar.setup" },
  { href: "/client/billing", copyKey: "client.sidebar.billing" },
];

export function ClientSidebar({ copy }: { copy?: Record<string, string> }) {
  const pathname = usePathname();
  const c = (copy ?? {}) as Record<AdminCopyKey, string>;

  return (
    <aside className="flex w-56 flex-col shrink-0 border-r border-site-border bg-site-card text-site-text">
      <div className="p-4 border-b border-site-border">
        <Link href="/client/dashboard" className="font-bold text-site-text">
          {getCopyValue(c, "client.dashboard.consoleTitle")}
        </Link>
      </div>
      <nav className="p-2 space-y-0.5">
        {MENU_KEYS.map((item) => {
          const label = getCopyValue(c, item.copyKey);
          const isActive = pathname === item.href || (item.href !== "/client/dashboard" && pathname?.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm hover:bg-site-bg hover:text-site-primary ${
                isActive ? "bg-site-bg text-site-primary font-medium" : "text-site-text"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-2 border-t border-site-border">
        <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-site-primary">
          {getCopyValue(c, "nav.home")}
        </Link>
      </div>
    </aside>
  );
}
