"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import type { ClientOrganization } from "@/types/client-organization";
import { ClientOrganizationSelect } from "@/components/client/console/ClientOrganizationSelect";
import { MobileLandscapeLockButton } from "@/components/MobileLandscapeLockButton";
import { ClientConsoleBottomNav } from "@/components/client/console/ClientConsoleBottomNav";
import { ClientConsoleMobileOverflowMenu } from "@/components/client/console/ClientConsoleMobileOverflowMenu";
import { ClientConsoleNewTournamentFab } from "@/components/client/console/ClientConsoleNewTournamentFab";
import {
  CLIENT_CONSOLE_HEADER_INNER_CLASS,
  CLIENT_CONSOLE_MAIN_SCROLL_CLASS,
} from "@/lib/console-layout";

/** 클라이언트 콘솔 사이드바 — 핵심 진입점 4개 */
type ClientConsoleNavId = "dash" | "tournament" | "billing" | "settings";

const CLIENT_CONSOLE_NAV: { id: ClientConsoleNavId; href: string; labelKey: AdminCopyKey }[] = [
  { id: "dash", href: "/client/dashboard", labelKey: "client.console.nav.dash" },
  { id: "tournament", href: "/client/tournaments", labelKey: "client.console.nav.tournament" },
  { id: "billing", href: "/client/billing", labelKey: "client.console.nav.billing" },
  { id: "settings", href: "/client/settings", labelKey: "client.console.nav.settings" },
];

function isClientNavActive(id: ClientConsoleNavId, pathname: string): boolean {
  switch (id) {
    case "dash":
      return pathname === "/client" || pathname === "/client/dashboard";
    case "tournament":
      return (
        pathname.startsWith("/client/operations") ||
        pathname.startsWith("/client/tournaments") ||
        pathname.startsWith("/client/feedback")
      );
    case "billing":
      return pathname.startsWith("/client/billing");
    case "settings":
      return (
        pathname.startsWith("/client/settings") ||
        pathname.startsWith("/client/setup") ||
        pathname.startsWith("/client/promo") ||
        pathname.startsWith("/client/content")
      );
    default:
      return false;
  }
}

function resolveConsoleTitle(pathname: string, c: Record<AdminCopyKey, string>): string {
  if (pathname === "/client" || pathname === "/client/dashboard") return getCopyValue(c, "client.console.title.dash");
  if (pathname.startsWith("/client/setup")) return getCopyValue(c, "client.console.title.settings");
  if (pathname.startsWith("/client/operations")) return getCopyValue(c, "client.console.title.operations");
  if (pathname.startsWith("/client/feedback")) return getCopyValue(c, "client.console.title.settings");
  if (pathname.startsWith("/client/tournaments")) return getCopyValue(c, "client.console.title.tournamentInfo");
  if (pathname.startsWith("/client/billing/platform")) return getCopyValue(c, "client.console.title.billingPlatform");
  if (pathname.startsWith("/client/billing")) return getCopyValue(c, "client.console.title.billing");
  if (pathname.startsWith("/client/settings")) return getCopyValue(c, "client.console.title.settings");
  if (pathname.startsWith("/client/promo") || pathname.startsWith("/client/content"))
    return getCopyValue(c, "client.console.title.settings");
  if (pathname.startsWith("/client/schedule")) return getCopyValue(c, "client.console.title.schedule");
  if (pathname.startsWith("/client/zones")) return getCopyValue(c, "client.console.title.zones");
  if (pathname.startsWith("/client/co-admins")) return getCopyValue(c, "client.console.title.coAdmins");
  return getCopyValue(c, "client.console.title.fallback");
}

const navBtn =
  "block w-full border-l-2 border-transparent px-2 py-2 text-left text-[13px] leading-tight text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800/80";
const navBtnActive =
  "border-zinc-800 bg-zinc-200/80 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50";

export function ClientConsoleShell({
  copy,
  organizations,
  activeOrganizationId,
  children,
}: {
  copy: Record<string, string>;
  organizations: ClientOrganization[];
  activeOrganizationId: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const c = copy as Record<AdminCopyKey, string>;
  const title = resolveConsoleTitle(pathname, c);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="hidden w-[15rem] shrink-0 flex-col border-r border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 lg:flex">
        <div className="flex h-12 shrink-0 items-center border-b border-zinc-300 px-3 dark:border-zinc-700">
          <Link
            href="/client/dashboard"
            className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {getCopyValue(c, "client.dashboard.consoleTitle")}
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {getCopyValue(c, "client.console.menuSection")}
          </p>
          <ul className="space-y-0.5">
            {CLIENT_CONSOLE_NAV.map((item) => {
              const active = isClientNavActive(item.id, pathname);
              return (
                <li key={item.id}>
                  <Link href={item.href} className={`${navBtn} ${active ? navBtnActive : ""}`}>
                    {getCopyValue(c, item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-zinc-300 p-2 dark:border-zinc-700">
          <Link
            href="/"
            className="block px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            {getCopyValue(c, "nav.home")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 w-full min-w-0 shrink-0 border-b border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
          <div className={CLIENT_CONSOLE_HEADER_INNER_CLASS}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Link
                href="/"
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md border border-zinc-400 bg-zinc-50 px-2 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 touch-manipulation dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                title={getCopyValue(c, "client.console.siteMainTitle")}
              >
                {getCopyValue(c, "client.console.homeButton")}
              </Link>
              <h1 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100 sm:text-[13px]">
                {title}
              </h1>
            </div>
            <MobileLandscapeLockButton />
            <ClientConsoleMobileOverflowMenu />
            <ClientOrganizationSelect organizations={organizations} activeOrganizationId={activeOrganizationId} />
          </div>
        </header>
        <main className={CLIENT_CONSOLE_MAIN_SCROLL_CLASS}>{children}</main>
        <ClientConsoleBottomNav copy={copy} />
        <ClientConsoleNewTournamentFab />
      </div>
    </div>
  );
}
