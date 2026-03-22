import type { HTMLAttributes } from "react";
import { cx } from "@/components/client/console/ui/cx";

export type ConsoleBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClass: Record<ConsoleBadgeTone, string> = {
  neutral: "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  danger: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
};

export interface ConsoleBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ConsoleBadgeTone;
}

/** 상태·라벨 배지 — 테두리 기반, 그림자 없음 */
export function ConsoleBadge({ className, tone = "neutral", ...props }: ConsoleBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}
