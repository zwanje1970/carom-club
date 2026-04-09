"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { cx } from "@/components/client/console/ui/cx";

function matchOperationsRoute(p: string): boolean {
  return (
    p.startsWith("/client/operations") ||
    p.startsWith("/client/tournaments") ||
    p.startsWith("/client/feedback")
  );
}

const BOTTOM_ITEMS: {
  href: string;
  labelKey: AdminCopyKey;
  match: (p: string) => boolean;
  Icon: typeof IconHome;
}[] = [
  {
    href: "/client/dashboard",
    labelKey: "client.console.bottomNav.home",
    match: (p: string) => p === "/client" || p === "/client/dashboard",
    Icon: IconHome,
  },
  {
    href: "/client/tournaments",
    labelKey: "client.console.bottomNav.tournaments",
    match: matchOperationsRoute,
    Icon: IconTrophy,
  },
  {
    href: "/client/billing",
    labelKey: "client.console.bottomNav.billing",
    match: (p: string) => p.startsWith("/client/billing"),
    Icon: IconWallet,
  },
  {
    href: "/client/settings",
    labelKey: "client.console.bottomNav.settings",
    match: (p: string) => p.startsWith("/client/settings"),
    Icon: IconCog,
  },
];

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrophy({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 21h8m-4-4v4M6 3h12v5a6 6 0 0 1-12 0V3zM6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20M16 14h.01" strokeLinecap="round" />
    </svg>
  );
}
function IconCog({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

/** 모바일 전용 하단 탭 (lg 이상 숨김) */
export function ClientConsoleBottomNav({ copy }: { copy: Record<string, string> }) {
  const pathname = usePathname() ?? "";
  const c = copy as Record<AdminCopyKey, string>;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-300 bg-white/95 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/95 lg:hidden"
      aria-label={getCopyValue(c, "client.console.bottomNav.aria")}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {BOTTOM_ITEMS.map(({ href, labelKey, match, Icon }) => {
          const active = match(pathname);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                className={cx(
                  "flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight",
                  active
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
              >
                <Icon className={cx("shrink-0", active ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400")} />
                <span className="truncate">{labelKey === "client.console.bottomNav.tournaments" ? "대회관리" : getCopyValue(c, labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
