"use client";

import Link from "next/link";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { ConsoleBadge } from "@/components/client/console/ui/ConsoleBadge";
import { cx } from "@/components/client/console/ui/cx";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  OPEN: "모집중",
  CLOSED: "마감",
  BRACKET_GENERATED: "대진 확정",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

type T = {
  id: string;
  name: string;
  startAt: Date;
  status: string;
  venue: string | null;
  confirmed: number;
  max: number | null;
};

/** 모바일 전용 대회 카드 — 운영 콘솔 + 참가자·대진표 + 더보기 */
export function OperationsTournamentMobileCard({ t }: { t: T }) {
  const base = `/client/operations/tournaments/${t.id}`;
  const info = `/client/tournaments/${t.id}`;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{t.name}</h3>
        <ConsoleBadge tone="neutral">{STATUS_LABEL[t.status] ?? t.status}</ConsoleBadge>
      </div>
      <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{formatKoreanDateWithWeekday(t.startAt)}</p>
      {t.venue?.trim() && (
        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-500">{t.venue}</p>
      )}
      <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
        확정 {t.confirmed}
        {t.max != null && t.max > 0 ? ` / ${t.max}` : ""}명
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`${base}/participants`}
          className={cx(
            "inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-md border border-zinc-900 bg-zinc-900 px-3 text-xs font-semibold text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          )}
        >
          운영 콘솔
        </Link>
        <Link
          href={`${base}/bracket`}
          className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-md border border-indigo-600 px-3 text-xs font-semibold text-indigo-800 dark:border-indigo-500 dark:text-indigo-200"
        >
          대진표
        </Link>
        <details className="relative flex-1 min-w-[44px]">
          <summary
            className={cx(
              "flex min-h-[44px] list-none cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:text-zinc-200",
              "[&::-webkit-details-marker]:hidden"
            )}
          >
            ···
          </summary>
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
            <Link
              href={`${base}/participant-roster`}
              className="block min-h-[44px] px-3 py-2.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              참가 명단 확정
            </Link>
            <Link
              href={`${base}/bracket-build`}
              className="block min-h-[44px] px-3 py-2.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              대진 생성
            </Link>
            <Link
              href={info}
              className="block min-h-[44px] px-3 py-2.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              대회 정보
            </Link>
            <Link
              href={`${base}/edit`}
              className="block min-h-[44px] px-3 py-2.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              대회 설정 수정
            </Link>
          </div>
        </details>
      </div>
    </div>
  );
}
