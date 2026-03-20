"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatCommunityListDate } from "@/lib/format-date";
import { CommunityBoardTabBar } from "@/components/community/CommunityBoardTabBar";
import { CommunityPopularPills, type PopularPillKey } from "@/components/community/CommunityPopularPills";
import { CommunityWriteFab } from "@/components/community/CommunityWriteFab";
import { COMMUNITY_HUB_SLUGS, orderedHubBoards } from "@/components/community/communityBoardConstants";

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
  thumbnailUrl?: string | null;
};

type BoardRow = { id: string; slug: string; name: string };

export default function CommunityBoardSlugPage() {
  const params = useParams();
  const boardSlug = params.boardSlug as string;
  const [board, setBoard] = useState<BoardRow | null>(null);
  const [hubBoards, setHubBoards] = useState<BoardRow[]>([]);
  const [pinned, setPinned] = useState<PostItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [popularMode, setPopularMode] = useState<PopularPillKey>("today");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "solved">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/community/boards")
      .then((r) => r.json())
      .then((data: BoardRow[]) => {
        if (Array.isArray(data))
          setHubBoards(orderedHubBoards(data.filter((b) => COMMUNITY_HUB_SLUGS.includes(b.slug as (typeof COMMUNITY_HUB_SLUGS)[number]))));
      })
      .catch(() => setHubBoards([]));
  }, []);

  useEffect(() => {
    setBoard(null);
    setPinned([]);
    setPosts([]);
    setPage(0);
    setStatusFilter("all");
    setPopularMode("today");
  }, [boardSlug]);

  useEffect(() => {
    if (!boardSlug) return;
    setLoading(true);
    const q = new URLSearchParams({ popular: popularMode, page: String(page), take: "20" });
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
  }, [boardSlug, popularMode, statusFilter, search, page]);

  const runSearch = () => setPage(0);

  const postHref = (id: string) =>
    boardSlug === "trouble" ? `/community/trouble/${id}` : `/community/${boardSlug}/${id}`;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  if (!board && !loading) {
    return (
      <main className="min-h-screen bg-site-bg text-site-text">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-red-600">게시판을 찾을 수 없습니다.</p>
          <Link href="/community" className="mt-2 inline-block text-site-primary underline">
            커뮤니티로
          </Link>
        </div>
      </main>
    );
  }

  const troubleFilterBtn = (active: boolean) =>
    `px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      active
        ? "border-site-primary text-site-text"
        : "border-transparent text-gray-500 dark:text-slate-400 hover:text-site-text"
    }`;

  const renderRow = (p: PostItem, isPin: boolean) => {
    return (
      <li key={p.id} className={isPin ? "bg-amber-50/30 dark:bg-amber-900/5" : ""}>
        <Link href={postHref(p.id)} className="flex items-start gap-3 px-1 py-3.5 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 sm:px-0">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-site-text line-clamp-2 leading-snug">
              {isPin && <span className="mr-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">공지</span>}
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
  };

  return (
    <main className="min-h-screen bg-site-bg text-site-text pb-24">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
        <nav className="mb-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">
            커뮤니티
          </Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">{board?.name ?? boardSlug}</span>
        </nav>

        {hubBoards.length > 0 && <CommunityBoardTabBar boards={hubBoards} />}

        <CommunityPopularPills
          value={popularMode}
          onChange={(v) => {
            setPopularMode(v);
            setPage(0);
          }}
          className="mt-2"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-site-text">{board?.name ?? ""}</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              aria-expanded={searchOpen}
              aria-label="검색"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="mt-2 flex gap-2">
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="검색어 입력"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                runSearch();
                setSearchOpen(false);
              }}
              className="shrink-0 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm font-medium"
            >
              적용
            </button>
          </div>
        )}

        {boardSlug === "trouble" && (
          <div className="mt-3 flex flex-wrap gap-0 border-b border-gray-200 dark:border-slate-600">
            {(
              [
                ["all", "전체"],
                ["open", "해결중"],
                ["solved", "해결완료"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key);
                  setPage(0);
                }}
                className={troubleFilterBtn(statusFilter === key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading && page === 0 && <p className="py-4 text-sm text-gray-500">불러오는 중…</p>}
        {!loading && (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {pinned.map((p) => renderRow(p, true))}
            {posts.map((p) => renderRow(p, false))}
            {pinned.length === 0 && posts.length === 0 && (
              <li className="py-10 text-center text-sm text-gray-500">글이 없습니다.</li>
            )}
          </ul>
        )}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className="rounded-lg border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              더 보기
            </button>
          </div>
        )}
      </div>

      <CommunityWriteFab
        href={boardSlug === "trouble" ? "/community/trouble/write" : `/community/${boardSlug}/write`}
      />
    </main>
  );
}
