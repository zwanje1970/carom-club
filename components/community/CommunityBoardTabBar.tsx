"use client";

import { useRef } from "react";
import Link from "next/link";
import { orderedHubBoards, tabLabelForSlug } from "./communityBoardConstants";
import { NanguSolverIcon } from "./NanguSolverIcon";

type Board = { id: string; slug: string; name: string };

type Props = {
  boards: Board[];
  /** 현재 게시판 slug (커뮤니티 홈이면 `""`) */
  activeSlug: string;
  showSolverEntry: boolean;
};

/**
 * 상단 게시판 탭 — 서버 렌더, `activeSlug`로 활성 표시
 */
export function CommunityBoardTabBar({ boards, activeSlug }: Props) {
  const ordered = orderedHubBoards(boards);
  const warmedRef = useRef<Set<string>>(new Set());

  const prewarmBoardList = (slug: string) => {
    if (slug === "trouble") return;
    if (warmedRef.current.has(slug)) return;
    warmedRef.current.add(slug);
    const params = new URLSearchParams({
      popular: "today",
      sort: "latest",
      take: "15",
    });
    fetch(`/api/community/boards/${slug}/posts?${params.toString()}`, {
      method: "GET",
      credentials: "include",
      cache: "force-cache",
    }).catch(() => {
      // prewarm failure is non-blocking
    });
  };

  return (
    <nav
      className="border-b border-gray-200 dark:border-slate-600 -mx-4 px-4 sm:mx-0 sm:px-0"
      aria-label="게시판 탭"
    >
      <div className="flex gap-0 overflow-x-auto scrollbar-none pb-px">
        {ordered.map((b) => {
          const href = b.slug === "trouble" ? "/community/nangu" : `/community/${b.slug}`;
          const active =
            activeSlug !== "" &&
            (b.slug === "trouble"
              ? activeSlug === "trouble" || activeSlug === "nangu"
              : activeSlug === b.slug);
          const label = tabLabelForSlug(b.slug, b.name);
          return (
            <Link
              key={b.id}
              href={href}
              prefetch={false}
              scroll={false}
              onMouseEnter={() => prewarmBoardList(b.slug)}
              onFocus={() => prewarmBoardList(b.slug)}
              onClick={() => prewarmBoardList(b.slug)}
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
