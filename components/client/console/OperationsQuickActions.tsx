"use client";

import Link from "next/link";
import { getCopyValue } from "@/lib/admin-copy";
import { cx } from "@/components/client/console/ui/cx";
import { OPERATIONS_QUICK_ACTION_CARD_CLASS } from "@/components/client/console/operationsQuickActionCardClass";

const card = OPERATIONS_QUICK_ACTION_CARD_CLASS;

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

type Props = {
  firstTournamentId: string | null;
  copy: Record<string, string>;
};

/** /client/operations 상단 빠른 실행 — 1행: 대회 생성·신청자 관리 / 2행: 대진·표 / 3행: 안내발송(푸시) */
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
      <div className="space-y-2 md:space-y-3">
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <Link href="/client/operations/tournaments/new" className={card}>
            <IconPlus className="text-zinc-700 dark:text-zinc-200" />
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
        </div>
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <Link href={base ? `${base}/bracket-build` : "/client/operations/participants"} className={cx(card, !base && "opacity-90")}>
            <IconGrid className="text-zinc-700 dark:text-zinc-200" />
            {getCopyValue(copy, "client.operations.quick.bracketBuild")}
            {!base && (
              <span className="text-[9px] font-normal text-zinc-500">
                {getCopyValue(copy, "client.operations.quick.selectTournamentHint")}
              </span>
            )}
          </Link>
          <Link href={base ? `${base}/bracket` : "/client/operations/participants"} className={cx(card, !base && "opacity-90")}>
            <IconTable className="text-zinc-700 dark:text-zinc-200" />
            {getCopyValue(copy, "client.operations.quick.bracketView")}
            {!base && (
              <span className="text-[9px] font-normal text-zinc-500">
                {getCopyValue(copy, "client.operations.quick.selectTournamentHint")}
              </span>
            )}
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 md:gap-3">
          <Link href="/client/operations/push" className={card}>
            <IconBell className="text-zinc-700 dark:text-zinc-200" />
            {getCopyValue(copy, "client.operations.quick.push")}
          </Link>
        </div>
      </div>
    </div>
  );
}
