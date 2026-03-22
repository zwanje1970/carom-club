import type { ReactNode } from "react";
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextBody, consoleTextMuted, consoleTextTitle } from "@/components/client/console/ui/tokens";

export interface ConsolePageHeaderProps {
  /** 페이지 제목 (메인 영역 첫 헤더 — 셸 헤더와 별개) */
  title: string;
  /** 부제·설명 */
  description?: string;
  /** 상단 한 줄 라벨 (예: 메뉴명) */
  eyebrow?: string;
  /** 우측: 버튼·배지·도구 */
  actions?: ReactNode;
  className?: string;
}

/**
 * 페이지 본문 상단 — 제목(좌) / 액션(우) 정렬 규칙 고정
 */
export function ConsolePageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: ConsolePageHeaderProps) {
  return (
    <header
      className={cx(
        "mb-4 flex flex-col gap-3 border-b border-zinc-300 pb-3 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-700",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className={cx("mb-1", consoleTextMuted)}>{eyebrow}</p> : null}
        <h1 className={cx(consoleTextTitle, "text-base")}>{title}</h1>
        {description ? <p className={cx("mt-1 max-w-3xl", consoleTextBody)}>{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
