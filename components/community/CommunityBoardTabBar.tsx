"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { orderedHubBoards, tabLabelForSlug } from "./communityBoardConstants";
import { NanguSolverIcon } from "./NanguSolverIcon";

type Board = { id: string; slug: string; name: string };

type Props = {
  boards: Board[];
};

/**
 * 상단 게시판 탭: 배경 없음, 선택 시 하단 border 강조만
 */
export function CommunityBoardTabBar({ boards }: Props) {
  const pathname = usePathname() ?? "";
  const ordered = orderedHubBoards(boards);

  return (
    <nav
      className="border-b border-gray-200 dark:border-slate-600 -mx-4 px-4 sm:mx-0 sm:px-0"
      aria-label="게시판 탭"
    >
      <div className="flex gap-0 overflow-x-auto scrollbar-none pb-px">
        {ordered.map((b) => {
          const href = b.slug === "trouble" ? "/community/trouble" : `/community/${b.slug}`;
          const active =
            b.slug === "trouble"
              ? pathname === "/community/trouble" || pathname.startsWith("/community/trouble/")
              : pathname === `/community/${b.slug}` || pathname.startsWith(`/community/${b.slug}/`);
          const label = tabLabelForSlug(b.slug, b.name);
          return (
            <Link
              key={b.id}
              href={href}
              className={`shrink-0 inline-flex items-center gap-0 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-site-primary text-site-text"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-site-text"
              }`}
            >
              {b.slug === "trouble" && <NanguSolverIcon size={32} />}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
