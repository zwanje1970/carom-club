"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 모바일 전용 — 대회 생성 (operations 구간만) */
export function ClientConsoleNewTournamentFab() {
  const pathname = usePathname() ?? "";
  const show =
    pathname.startsWith("/client/operations") &&
    !pathname.includes("/tournaments/new") &&
    !pathname.startsWith("/client/operations/tournaments/new");

  if (!show) return null;

  return (
    <Link
      href="/client/operations/tournaments/new"
      className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-zinc-900 bg-zinc-900 text-white shadow-lg transition hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white lg:hidden"
      aria-label="새 대회 만들기"
      title="새 대회"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
