"use client";

import Link from "next/link";
import { getCopyValue } from "@/lib/admin-copy";
import { cx } from "@/components/client/console/ui/cx";

const btn =
  "inline-flex min-h-[44px] items-center justify-center rounded-md border px-2.5 py-2 text-[10px] font-medium leading-tight sm:text-[11px] whitespace-nowrap";
const btnSecondary =
  "border-zinc-300 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800";
const btnPrimary =
  "border-zinc-800 bg-zinc-800 text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white";

/** 대회 목록 테이블 — 행당 운영 진입 (모바일: 주요 2개 + 더보기) */
export function OperationsTournamentListRowActions({
  tournamentId,
  copy,
}: {
  tournamentId: string;
  copy: Record<string, string>;
}) {
  const base = `/client/operations/tournaments/${tournamentId}`;
  const info = `/client/tournaments/${tournamentId}`;

  const links = [
    { href: `${base}/participants`, label: getCopyValue(copy, "client.operations.mobile.btnOpsConsole"), primary: true },
    { href: `${base}/bracket`, label: getCopyValue(copy, "client.operations.mobile.btnBracket"), primary: true },
    { href: info, label: getCopyValue(copy, "client.operations.mobile.linkTournamentInfo"), primary: false },
    { href: `${base}/participant-roster`, label: getCopyValue(copy, "client.operations.mobile.linkRoster"), primary: false },
    { href: `${base}/bracket-build`, label: getCopyValue(copy, "client.operations.mobile.linkBracketBuild"), primary: false },
  ];
  const editHref = `${base}/edit`;
  const editLabel = getCopyValue(copy, "client.operations.mobile.linkEditTournament");

  const primaryLinks = links.filter((l) => l.primary);
  const moreLinks = links.filter((l) => !l.primary);

  return (
    <div className="flex max-w-[20rem] flex-col items-end gap-1.5 sm:max-w-none">
      {/* 데스크톱: 단계별 라벨을 한 줄에 */}
      <div className="hidden flex-wrap justify-end gap-1 md:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={cx(btn, btnPrimary)}>
            {l.label}
          </Link>
        ))}
        <Link href={editHref} className={cx(btn, btnSecondary)}>
          {editLabel}
        </Link>
      </div>

      {/* 모바일: 핵심 2개 + 더보기 */}
      <div className="flex flex-col items-end gap-1.5 md:hidden">
        <div className="flex flex-wrap justify-end gap-1">
          {primaryLinks.map((l) => (
            <Link key={l.href} href={l.href} className={cx(btn, btnPrimary)}>
              {l.label}
            </Link>
          ))}
        </div>
        <details className="relative text-right">
          <summary
            className={cx(
              btn,
              btnSecondary,
              "inline-block list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden"
            )}
          >
            {getCopyValue(copy, "client.operations.rowActions.menuSummary")}
          </summary>
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-600 dark:bg-zinc-900">
            {moreLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block px-3 py-1.5 text-left text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={editHref}
              className="block px-3 py-1.5 text-left text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {editLabel}
            </Link>
          </div>
        </details>
      </div>
    </div>
  );
}
