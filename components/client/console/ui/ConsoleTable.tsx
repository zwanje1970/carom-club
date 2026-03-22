import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cx } from "@/components/client/console/ui/cx";
import { consoleBorder, consoleRadius, consoleSurface } from "@/components/client/console/ui/tokens";

export interface ConsoleTableProps {
  children: ReactNode;
  className?: string;
  /** 가로 스크롤 래퍼 (기본 true) */
  scroll?: boolean;
  /**
   * true: `ConsoleSection` 등 이미 테두리가 있을 때 이중 테두리 방지 (스크롤만 감쌈)
   */
  embedded?: boolean;
}

/**
 * 표형 데이터 — 테두리·헤더 배경·셀 패딩 통일
 */
export function ConsoleTable({ children, className, scroll = true, embedded }: ConsoleTableProps) {
  const inner = (
    <table
      className={cx(
        "w-full min-w-[36rem] border-collapse text-left text-xs tabular-nums text-zinc-800 dark:text-zinc-200",
        className
      )}
    >
      {children}
    </table>
  );

  if (embedded) {
    return <div className="max-w-full overflow-x-auto">{inner}</div>;
  }

  if (!scroll) {
    return (
      <div className={cx(consoleBorder, consoleRadius, consoleSurface, "overflow-hidden")}>{inner}</div>
    );
  }

  return (
    <div
      className={cx(
        consoleBorder,
        consoleRadius,
        consoleSurface,
        "max-w-full overflow-x-auto"
      )}
    >
      {inner}
    </div>
  );
}

export function ConsoleTableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cx(
        "border-b border-zinc-200 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

export function ConsoleTableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cx("divide-y divide-zinc-100 dark:divide-zinc-800", className)} {...props} />;
}

export function ConsoleTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cx(
        "hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40",
        className
      )}
      {...props}
    />
  );
}

export function ConsoleTableTh({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx("whitespace-nowrap px-3 py-2 text-left font-semibold", className)}
      {...props}
    />
  );
}

export function ConsoleTableTd({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("px-3 py-2 align-middle text-zinc-800 dark:text-zinc-200", className)} {...props} />
  );
}
