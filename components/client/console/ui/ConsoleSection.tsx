import type { ReactNode } from "react";
import { cx } from "@/components/client/console/ui/cx";
import {
  consoleBorder,
  consoleRadius,
  consoleSurface,
  consoleTextBody,
  consoleTextMuted,
  consoleTextTitle,
} from "@/components/client/console/ui/tokens";

export interface ConsoleSectionProps {
  title?: string;
  description?: string;
  /** 헤더 없이 테두리만 */
  plain?: boolean;
  children: ReactNode;
  className?: string;
  /** 본문 패딩 제거 (테이블 풀블리드 등) */
  flush?: boolean;
}

/**
 * 섹션 래퍼 — 제목·설명·본문 영역 분리
 */
export function ConsoleSection({
  title,
  description,
  plain,
  children,
  className,
  flush,
}: ConsoleSectionProps) {
  if (plain) {
    return <section className={cx("space-y-3", className)}>{children}</section>;
  }

  return (
    <section
      className={cx(consoleBorder, consoleRadius, consoleSurface, "overflow-hidden", className)}
    >
      {(title || description) && (
        <div className="border-b border-zinc-300 px-3 py-2.5 dark:border-zinc-700">
          {title ? <h2 className={consoleTextTitle}>{title}</h2> : null}
          {description ? <p className={cx("mt-0.5", consoleTextMuted)}>{description}</p> : null}
        </div>
      )}
      <div className={flush ? undefined : "p-3"}>{children}</div>
    </section>
  );
}
