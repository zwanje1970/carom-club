"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { formatCommunityListDate } from "@/lib/format-date";
import { CommunityBoardPostThumb } from "@/components/community/CommunityBoardPostThumb";
import type { BoardListPostDto } from "@/lib/community-board-page-data";
import type { CommunityBoardPopularMode } from "@/lib/community-board-query-key";
import { communityBoardClientPerf } from "@/lib/community-board-client-perf";

/**
 * 목록 + 더보기만 클라이언트 (인기·필터는 서버 `<Link>`).
 * 첫 데이터는 SSR props와 동일 → 추가 fetch 없음.
 */
export function CommunityBoardListAndMoreClient({
  boardSlug,
  popular,
  q,
  statusFilter,
  take,
  initialPinned,
  initialPosts,
  initialNextCursor,
  initialHasMore,
}: {
  boardSlug: string;
  popular: CommunityBoardPopularMode;
  q: string;
  statusFilter: "all" | "open" | "solved";
  take: number;
  initialPinned: BoardListPostDto[];
  initialPosts: BoardListPostDto[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
}) {
  const [pinned] = useState<BoardListPostDto[]>(initialPinned);
  const [posts, setPosts] = useState<BoardListPostDto[]>(initialPosts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const postHref = useCallback(
    (id: string) =>
      boardSlug === "trouble" ? `/community/trouble/${id}` : `/community/${boardSlug}/${id}`,
    [boardSlug]
  );

  const loadMore = useCallback(() => {
    if (!nextCursor || loading) return;
    communityBoardClientPerf("load_more_cursor_start", { boardSlug });
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    setLoading(true);
    const sp = new URLSearchParams({
      popular,
      take: String(take),
      cursor: nextCursor,
    });
    if (q.trim()) sp.set("q", q.trim());
    if (boardSlug === "trouble" && statusFilter !== "all") sp.set("status", statusFilter);

    // 브라우저/중간 캐시가 동작하도록 캐시 힌트 부여(서버 Revalidate는 Route Handler Cache-Control로 제어)
    fetch(`/api/community/boards/${boardSlug}/posts?${sp}`, {
      credentials: "include",
      cache: "force-cache",
    })
      .then((res) => {
        if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
        return res.json();
      })
      .then(
        (data: {
          posts: BoardListPostDto[];
          nextCursor?: string | null;
          hasMore?: boolean;
        }) => {
          setPosts((prev) => [...prev, ...data.posts]);
          setNextCursor(data.nextCursor ?? null);
          setHasMore(data.hasMore ?? false);
          const ms = typeof performance !== "undefined" ? performance.now() - t0 : 0;
          communityBoardClientPerf("load_more_cursor_done", { ms: Math.round(ms) });
        }
      )
      .catch(() => {
        communityBoardClientPerf("load_more_cursor_error", { boardSlug });
      })
      .finally(() => setLoading(false));
  }, [boardSlug, popular, q, statusFilter, take, nextCursor, loading]);

  const renderRow = (p: BoardListPostDto, isPin: boolean) => (
    <li key={p.id} className={isPin ? "bg-amber-50/30 dark:bg-amber-900/5" : ""}>
      <Link
        href={postHref(p.id)}
        className="flex items-start gap-3 px-1 py-3.5 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 sm:px-0"
      >
        <CommunityBoardPostThumb url={p.thumbnailUrl} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-site-text line-clamp-2 leading-snug">
            {isPin && (
              <span className="mr-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">공지</span>
            )}
            {p.title}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {p.authorName} · {formatCommunityListDate(p.createdAt)} · 조회 {p.viewCount}
          </p>
        </div>
        <span className="shrink-0 self-start rounded-md border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
          {p.commentCount}
        </span>
      </Link>
    </li>
  );

  return (
    <>
      <ul className="divide-y divide-gray-200 dark:divide-slate-700">
        {pinned.map((p) => renderRow(p, true))}
        {posts.map((p) => renderRow(p, false))}
        {pinned.length === 0 && posts.length === 0 && (
          <li className="py-10 text-center text-sm text-gray-500">글이 없습니다.</li>
        )}
      </ul>
      {loading && (
        <p className="py-3 text-center text-xs text-gray-500">더 불러오는 중…</p>
      )}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => loadMore()}
            disabled={loading || !nextCursor}
            className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            더 보기
          </button>
        </div>
      )}
    </>
  );
}
