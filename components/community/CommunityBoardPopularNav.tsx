import Link from "next/link";
import type { CommunityBoardPopularMode } from "@/lib/community-board-query-key";
import {
  buildCommunityBoardListQueryString,
  communityBoardListHref,
} from "@/lib/community-board-nav-url";

const KEYS: CommunityBoardPopularMode[] = ["today", "weekly", "liked", "comments"];

const LABELS: Record<CommunityBoardPopularMode, string> = {
  today: "오늘",
  weekly: "주간",
  liked: "추천",
  comments: "댓글",
};

/** 인기 pill — 전부 `<Link>` (클라이언트 상태·JS 최소화) */
export function CommunityBoardPopularNav({
  boardSlug,
  current,
  q,
  statusFilter,
  className = "",
}: {
  boardSlug: string;
  current: CommunityBoardPopularMode;
  q: string;
  statusFilter: "all" | "open" | "solved";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="인기 기준"
      className={`flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {KEYS.map((key) => {
        const qs = buildCommunityBoardListQueryString({ boardSlug, popular: key, q, statusFilter });
        const href = communityBoardListHref(boardSlug, qs);
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={active}
            scroll={false}
            className={`h-9 shrink-0 rounded-full px-3.5 text-sm transition-colors ${
              active
                ? "bg-site-primary/12 font-semibold text-site-text dark:bg-site-primary/20"
                : "font-medium text-gray-500 hover:bg-gray-100 hover:text-site-text dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {LABELS[key]}
          </Link>
        );
      })}
    </div>
  );
}
