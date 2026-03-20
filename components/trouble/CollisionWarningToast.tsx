"use client";

import { TROUBLE_SOLUTION_CONSOLE } from "@/components/trouble/trouble-console-contract";

export function CollisionWarningToast({
  message,
  onDismiss,
  regionAttr,
}: {
  message: string | null;
  onDismiss: () => void;
  /** data-trouble-region (기본: 콘솔 계약) */
  regionAttr?: string;
}) {
  if (!message) return null;
  const region = regionAttr ?? TROUBLE_SOLUTION_CONSOLE.region.collisionWarning;
  return (
    <div
      role="alert"
      data-trouble-region={region}
      className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg bg-amber-900 text-amber-50 border border-amber-700 max-w-[min(90vw,420px)] text-center text-sm font-medium flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center dark:bg-amber-950 dark:text-amber-100"
    >
      <span>{message}</span>
      <button
        type="button"
        data-trouble-action={TROUBLE_SOLUTION_CONSOLE.action.dismissCollision}
        onClick={onDismiss}
        className="text-xs underline opacity-90 hover:opacity-100"
      >
        닫기
      </button>
    </div>
  );
}
