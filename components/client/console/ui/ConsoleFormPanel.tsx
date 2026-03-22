import type { ReactNode } from "react";
import { cx } from "@/components/client/console/ui/cx";
import {
  consoleBorder,
  consoleBorderB,
  consoleBorderT,
  consoleRadius,
  consoleSurface,
  consoleTextBody,
  consoleTextTitle,
} from "@/components/client/console/ui/tokens";

export interface ConsoleFormPanelProps {
  title?: string;
  description?: string;
  children: ReactNode;
  /** 푸터: 저장/취소 등 (패널 내부 하단 테두리 위) */
  footer?: ReactNode;
  className?: string;
}

/**
 * 폼 입력용 패널 — 필드 그룹을 테두리로 묶음
 */
export function ConsoleFormPanel({ title, description, children, footer, className }: ConsoleFormPanelProps) {
  return (
    <div className={cx(consoleBorder, consoleRadius, consoleSurface, "overflow-hidden", className)}>
      {(title || description) && (
        <div className={cx("px-3 py-2.5", consoleBorderB)}>
          {title ? <h2 className={consoleTextTitle}>{title}</h2> : null}
          {description ? <p className={cx("mt-1 max-w-2xl", consoleTextBody)}>{description}</p> : null}
        </div>
      )}
      <div className="space-y-3 p-3">{children}</div>
      {footer ? (
        <div
          className={cx(
            "flex flex-wrap items-center justify-end gap-2 px-3 py-2.5",
            consoleBorderT
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
