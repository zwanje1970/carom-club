import Link from "next/link";
import type { CommunityBoardPopularMode } from "@/lib/community-board-query-key";
import {
  buildCommunityBoardListQueryString,
  communityBoardListHref,
} from "@/lib/community-board-nav-url";

const OPTIONS = [
  ["all", "전체"],
  ["open", "해결중"],
  ["solved", "해결완료"],
] as const;

/** 난구 게시판 상태 탭 — `<Link>` 기반 */
export function CommunityBoardTroubleStatusNav({
  popular,
  q,
  current,
}: {
  popular: CommunityBoardPopularMode;
  q: string;
  current: "all" | "open" | "solved";
}) {
  const boardSlug = "trouble";
  return (
    <div className="mt-3 flex flex-wrap gap-0 border-b border-gray-200 dark:border-slate-600">
      {OPTIONS.map(([key, label]) => {
        const qs = buildCommunityBoardListQueryString({
          boardSlug,
          popular,
          q,
          statusFilter: key,
        });
        const href = communityBoardListHref(boardSlug, qs);
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            scroll={false}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-site-primary text-site-text"
                : "border-transparent text-gray-500 dark:text-slate-400 hover:text-site-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
