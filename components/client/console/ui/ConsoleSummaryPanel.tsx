import { cx } from "@/components/client/console/ui/cx";
import {
  consoleBorder,
  consoleRadius,
  consoleSurface,
  consoleTextMuted,
} from "@/components/client/console/ui/tokens";

export type ConsoleSummaryItem = {
  label: string;
  value: string | number;
  hint?: string;
};

export interface ConsoleSummaryPanelProps {
  items: ConsoleSummaryItem[];
  /** 반응형 그리드 열 수 (기본 4) */
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const colClass: Record<NonNullable<ConsoleSummaryPanelProps["columns"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
};

/**
 * 요약 숫자·지표 — 테두리 셀 분할, 카드형 그림자 없음
 */
export function ConsoleSummaryPanel({ items, columns = 4, className }: ConsoleSummaryPanelProps) {
  return (
    <div
      className={cx(
        consoleBorder,
        consoleRadius,
        consoleSurface,
        "grid grid-cols-1 gap-px bg-zinc-300 dark:bg-zinc-700",
        colClass[columns],
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className={cx(consoleSurface, "min-w-0 px-3 py-2.5")}>
          <p className={cx(consoleTextMuted, "mb-1")}>{item.label}</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{item.value}</p>
          {item.hint ? <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-500">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
