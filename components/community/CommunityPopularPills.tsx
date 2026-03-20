"use client";

export type PopularPillKey = "today" | "weekly" | "liked" | "comments";

const KEYS: PopularPillKey[] = ["today", "weekly", "liked", "comments"];

const LABELS: Record<PopularPillKey, string> = {
  today: "오늘",
  weekly: "주간",
  liked: "추천",
  comments: "댓글",
};

export function CommunityPopularPills({
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel = "인기 기준",
}: {
  value: PopularPillKey;
  onChange: (v: PopularPillKey) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {KEYS.map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`h-9 shrink-0 rounded-full px-3.5 text-sm transition-colors ${
              active
                ? "bg-site-primary/12 font-semibold text-site-text dark:bg-site-primary/20"
                : "font-medium text-gray-500 hover:bg-gray-100 hover:text-site-text dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
