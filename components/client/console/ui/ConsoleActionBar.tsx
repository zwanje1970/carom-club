import type { ReactNode } from "react";
import { cx } from "@/components/client/console/ui/cx";
import { consoleBorderT, consoleSurface } from "@/components/client/console/ui/tokens";

export interface ConsoleActionBarProps {
  /** 좌측: 보조 문구·체크박스 등 */
  left?: ReactNode;
  /** 우측: 주요 버튼 (저장·등록 등) */
  right?: ReactNode;
  /** 하단 고정 (폼이 길 때) */
  sticky?: boolean;
  className?: string;
}

/**
 * 하단 액션 영역 — 좌 보조 / 우 주 버튼 정렬
 */
export function ConsoleActionBar({ left, right, sticky, className }: ConsoleActionBarProps) {
  return (
    <div
      className={cx(
        consoleBorderT,
        consoleSurface,
        "flex flex-col gap-2 px-0 py-3 sm:flex-row sm:items-center sm:justify-between",
        sticky && "sticky bottom-0 z-10 -mx-4 border-b-0 bg-zinc-100/95 px-4 backdrop-blur-sm dark:bg-zinc-950/95 md:-mx-6 md:px-6",
        className
      )}
    >
      <div className="min-w-0 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        {left}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">{right}</div>
    </div>
  );
}
