import type { ReactNode } from "react";
import { cx } from "@/components/client/console/ui/cx";
import { consoleBorder, consoleRadius, consoleSurface } from "@/components/client/console/ui/tokens";

export interface ConsoleFilterBarProps {
  children: ReactNode;
  className?: string;
  /** 필터 바 상단에 짧은 설명 */
  hint?: string;
}

/**
 * 목록·표 상단 필터 영역 — 한 줄에 여러 컨트롤을 감쌀 때 사용
 */
export function ConsoleFilterBar({ children, className, hint }: ConsoleFilterBarProps) {
  return (
    <div className={cx("space-y-2", className)}>
      {hint ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{hint}</p>
      ) : null}
      <div
        className={cx(
          consoleBorder,
          consoleRadius,
          consoleSurface,
          "flex flex-wrap items-end gap-2 px-3 py-2.5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
