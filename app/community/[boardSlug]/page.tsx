"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type PostItem = {
  id: string;
  title: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  isPinned: boolean;
  createdAt: string;
  isSolved?: boolean;
};

export default function CommunityBoardSlugPage() {
  const params = useParams();
  const boardSlug = params.boardSlug as string;
  const [board, setBoard] = useState<{ id: string; slug: string; name: string } | null>(null);
  const [pinned, setPinned] = useState<PostItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"latest" | "likes">("latest");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "solved">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setBoard(null);
    setPinned([]);
    setPosts([]);
    setPage(0);
    setStatusFilter("all");
  }, [boardSlug]);

  useEffect(() => {
    if (!boardSlug) return;
    setLoading(true);
    const q = new URLSearchParams({ sort, page: String(page), take: "20" });
    if (search.trim()) q.set("q", search.trim());
    if (boardSlug === "trouble" && statusFilter !== "all") q.set("status", statusFilter);
    fetch(`/api/community/boards/${boardSlug}/posts?${q}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => {
        setBoard(data.board);
        setPinned(data.pinned ?? []);
        setPosts(page === 0 ? data.posts : (prev) => [...prev, ...data.posts]);
        setHasMore(data.hasMore ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [boardSlug, sort, statusFilter, search, page]);

  const runSearch = () => setPage(0);

  const postHref = (id: string) =>
    boardSlug === "trouble" ? `/community/trouble/${id}` : `/community/${boardSlug}/${id}`;

  if (!board && !loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-red-600">게시판을 찾을 수 없습니다.</p>
          <Link href="/community" className="mt-2 inline-block text-site-primary underline">커뮤니티로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">{board?.name ?? boardSlug}</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold">{board?.name ?? ""}</h1>
          <Link
            href={`/community/${boardSlug}/write`}
            className="shrink-0 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium"
          >
            글쓰기
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          {boardSlug === "trouble" && (
            <div className="flex rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden">
              <button type="button" onClick={() => { setStatusFilter("all"); setPage(0); }} className={`px-3 py-2 text-sm font-medium ${statusFilter === "all" ? "bg-site-primary text-white" : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300"}`}>전체</button>
              <button type="button" onClick={() => { setStatusFilter("open"); setPage(0); }} className={`px-3 py-2 text-sm font-medium ${statusFilter === "open" ? "bg-site-primary text-white" : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300"}`}>해결중</button>
              <button type="button" onClick={() => { setStatusFilter("solved"); setPage(0); }} className={`px-3 py-2 text-sm font-medium ${statusFilter === "solved" ? "bg-site-primary text-white" : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300"}`}>해결완료</button>
            </div>
          )}
          <div className="flex rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden">
            <button type="button" onClick={() => { setSort("latest"); setPage(0); }} className={`px-3 py-2 text-sm font-medium ${sort === "latest" ? "bg-site-primary text-white" : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300"}`}>최신순</button>
            <button type="button" onClick={() => { setSort("likes"); setPage(0); }} className={`px-3 py-2 text-sm font-medium ${sort === "likes" ? "bg-site-primary text-white" : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300"}`}>추천순</button>
          </div>
          <div className="flex-1 min-w-[180px] flex gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="검색"
              className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
            <button type="button" onClick={runSearch} className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium">
              검색
            </button>
          </div>
        </div>

        {loading && page === 0 && <p className="text-gray-500 py-4">불러오는 중…</p>}
        {!loading && (
          <ul className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-600">
            {pinned.map((p) => (
              <li key={p.id} className="bg-amber-50/50 dark:bg-amber-900/10">
                <Link href={postHref(p.id)} className="block px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                  <span className="inline-block mr-2 text-xs text-amber-700 dark:text-amber-400 font-medium">[공지]</span>
                  <span className="font-medium text-site-text">{p.title}</span>
                  <span className="text-xs text-gray-500 mt-0.5 block">
                    {p.authorName} · 추천 {p.likeCount} · 댓글 {p.commentCount} · 조회 {p.viewCount} · {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={postHref(p.id)} className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <span className="font-medium text-site-text line-clamp-1">
                    {p.isSolved && <span className="inline-block mr-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">[해결]</span>}
                    {p.title}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5 block">
                    {p.authorName} · 추천 {p.likeCount} · 댓글 {p.commentCount} · 조회 {p.viewCount} · {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
            {pinned.length === 0 && posts.length === 0 && (
              <li className="px-4 py-8 text-center text-gray-500 text-sm">글이 없습니다.</li>
            )}
          </ul>
        )}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className="py-2 px-4 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium disabled:opacity-50"
            >
              더 보기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
