"use client";

import Link from "next/link";
import type { OperationPhaseStepUi } from "@/lib/client-tournament-operation-phase";
import { cx } from "@/components/client/console/ui/cx";

export function OperationsTournamentPhaseStepper({ steps }: { steps: OperationPhaseStepUi[] }) {
  return (
    <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/50 px-2 py-3 dark:border-indigo-900/60 dark:bg-indigo-950/30">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
        운영 단계
      </p>
      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((s, i) => (
          <div key={s.id} className="flex min-w-0 shrink-0 items-center">
            {i > 0 && (
              <span className="mx-0.5 text-[10px] text-zinc-400 dark:text-zinc-500" aria-hidden>
                →
              </span>
            )}
            <Link
              href={s.href}
              className={cx(
                "flex min-h-[44px] min-w-[4.5rem] max-w-[7rem] flex-col items-center justify-center rounded-md border px-1.5 py-1.5 text-center text-[10px] font-semibold leading-tight transition sm:min-w-[5.5rem] sm:max-w-none sm:px-2 sm:text-[11px]",
                s.state === "done" &&
                  "border-emerald-600/50 bg-emerald-100/90 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100",
                s.state === "current" &&
                  "border-indigo-600 bg-indigo-600 text-white shadow-sm dark:border-indigo-400 dark:bg-indigo-500",
                s.state === "pending" &&
                  "border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              {s.label}
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-[9px] text-zinc-500 dark:text-zinc-400">
        대진은 초안 생성 후 검토·확정하는 구조로 확장 예정입니다. 현재는 생성 즉시 본선 경기에 반영됩니다.
      </p>
    </div>
  );
}
