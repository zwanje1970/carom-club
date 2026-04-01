"use client";

import Link from "next/link";
import { getCopyValue } from "@/lib/admin-copy";
import { cx } from "@/components/client/console/ui/cx";

const card =
  "flex min-h-[88px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-3 text-center text-[11px] font-semibold text-zinc-900 shadow-sm transition active:scale-[0.98] touch-manipulation break-words dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 md:min-h-[88px]";

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" strokeLinejoin="round" />
    </svg>
  );
}
function IconTable({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 9h18M9 4v16" strokeLinecap="round" />
    </svg>
  );
}
function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 21a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}
function IconMegaphone({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6l-4 4H4a1 1 0 0 0-1 1z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 9a5 5 0 0 1 0 6" strokeLinecap="round" />
      <path d="M17 7a8 8 0 0 1 0 10" strokeLinecap="round" />
    </svg>
  );
}
function IconBug({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 8a4 4 0 0 1 8 0v7a4 4 0 1 1-8 0V8z" strokeLinecap="round" />
      <path d="M12 4v2M4 13h3m10 0h3M5 8l2 2m10-2-2 2M5 18l2-2m10 2-2-2" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  firstTournamentId: string | null;
  copy: Record<string, string>;
};

/** /client/operations 상단 빠른 실행 */
export function OperationsQuickActions({ firstTournamentId, copy }: Props) {
  const base = firstTournamentId ? `/client/operations/tournaments/${firstTournamentId}` : null;

  return (
    <div
      id="operations-quick-actions"
      className="rounded-lg border border-zinc-200 bg-zinc-50/90 p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {getCopyValue(copy, "client.operations.quick.sectionTitle")}
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Link
          href="/client/operations/tournaments/new"
          className={cx(card, "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900")}
        >
          <IconPlus className="text-white dark:text-zinc-900" />
          {getCopyValue(copy, "client.operations.quick.newTournament")}
        </Link>
        <Link
          href={base ? `${base}/participants` : "/client/operations/participants"}
          className={cx(card, !base && "opacity-90")}
          aria-disabled={!base}
        >
          <IconUsers className="text-zinc-700 dark:text-zinc-200" />
          {getCopyValue(copy, "client.operations.quick.participants")}
          {!base && (
            <span className="text-[9px] font-normal text-zinc-500">
              {getCopyValue(copy, "client.operations.quick.noTournamentHint")}
            </span>
          )}
        </Link>
        <Link
          href={base ? `${base}/bracket-build` : "/client/operations/participants"}
          className={cx(card, !base && "opacity-90")}
        >
          <IconGrid className="text-zinc-700 dark:text-zinc-200" />
          {getCopyValue(copy, "client.operations.quick.bracketBuild")}
          {!base && (
            <span className="text-[9px] font-normal text-zinc-500">
              {getCopyValue(copy, "client.operations.quick.selectTournamentHint")}
            </span>
          )}
        </Link>
        <Link
          href={base ? `${base}/bracket` : "/client/operations/participants"}
          className={cx(card, !base && "opacity-90")}
        >
          <IconTable className="text-zinc-700 dark:text-zinc-200" />
          {getCopyValue(copy, "client.operations.quick.bracketView")}
          {!base && (
            <span className="text-[9px] font-normal text-zinc-500">
              {getCopyValue(copy, "client.operations.quick.selectTournamentHint")}
            </span>
          )}
        </Link>
        <Link href="/client/operations/push" className={card}>
          <IconBell className="text-zinc-700 dark:text-zinc-200" />
          {getCopyValue(copy, "client.operations.quick.push")}
        </Link>
        <Link href="/client/feedback/feature" className={card}>
          <IconMegaphone className="text-zinc-700 dark:text-zinc-200" />
          {getCopyValue(copy, "client.operations.quick.featureFeedback")}
        </Link>
        <Link href="/client/feedback/bug" className={card}>
          <IconBug className="text-zinc-700 dark:text-zinc-200" />
          {getCopyValue(copy, "client.operations.quick.bugReport")}
        </Link>
      </div>
    </div>
  );
}
