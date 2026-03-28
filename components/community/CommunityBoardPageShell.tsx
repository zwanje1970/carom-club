import Link from "next/link";
import type { CommunityBoardPagePayload } from "@/lib/community-board-page-data";
import { CommunityBoardTabBar } from "@/components/community/CommunityBoardTabBar";
import { CommunityBoardTroubleStatusNav } from "@/components/community/CommunityBoardTroubleStatusNav";
import { CommunityBoardListAndMoreClient } from "@/components/community/CommunityBoardListAndMoreClient";
import { CommunityWriteFab } from "@/components/community/CommunityWriteFab";
export function CommunityBoardPageShell({
  boardSlug,
  data,
  showSolverEntry,
}: {
  boardSlug: string;
  data: CommunityBoardPagePayload;
  showSolverEntry: boolean;
}) {
  const formAction = boardSlug === "trouble" ? "/community/trouble" : `/community/${boardSlug}`;
  const showWriteFab = showSolverEntry;

  return (
    <main className="min-h-screen bg-site-bg text-site-text pb-24">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
        <nav
          className="mb-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 md:flex hidden"
          aria-label="breadcrumb"
        >
          <Link href="/community" className="hover:text-site-primary">
            커뮤니티
          </Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">{data.board.name}</span>
        </nav>

        {data.hubBoards.length > 0 && (
          <CommunityBoardTabBar
            boards={data.hubBoards}
            activeSlug={boardSlug}
            showSolverEntry={showSolverEntry}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 md:block hidden">
          <h1 className="text-lg font-bold text-site-text">{data.board.name}</h1>
        </div>

        <details className="mt-2 group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-medium text-site-text">검색</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </summary>
          <form method="get" action={formAction} className="mt-2 flex flex-wrap gap-2">
            {data.popular !== "today" ? (
              <input type="hidden" name="popular" value={data.popular} />
            ) : null}
            {boardSlug === "trouble" && data.statusFilter !== "all" ? (
              <input type="hidden" name="status" value={data.statusFilter} />
            ) : null}
            <input
              type="search"
              name="q"
              defaultValue={data.q}
              placeholder="검색어 입력"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm font-medium"
            >
              적용
            </button>
          </form>
        </details>

        {boardSlug === "trouble" && (
          <CommunityBoardTroubleStatusNav
            popular={data.popular}
            q={data.q}
            current={data.statusFilter}
          />
        )}

        <div className="mt-2">
          <CommunityBoardListAndMoreClient
            boardSlug={boardSlug}
            popular={data.popular}
            q={data.q}
            statusFilter={data.statusFilter}
            sort={data.sort}
            take={data.take}
            initialPinned={data.pinned}
            initialPosts={data.posts}
            initialNextCursor={data.nextCursor}
            initialHasMore={data.hasMore}
          />
        </div>
      </div>

      {showWriteFab && (
        <CommunityWriteFab
          href={boardSlug === "trouble" ? "/community/nangu/write" : `/community/${boardSlug}/write`}
        />
      )}
    </main>
  );
}
