"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatKoreanDate } from "@/lib/format-date";

type PostRow = {
  id: string;
  title: string;
  boardSlug: string;
  boardName: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

type CommentRow = {
  id: string;
  content: string;
  likeCount: number;
  createdAt: string;
  postId: string;
  postTitle: string;
  boardSlug: string;
  boardName: string;
};

export default function MypageCommunityPage() {
  const [tab, setTab] = useState<"posts" | "comments" | "received-likes" | "bookmarks">("posts");
  const [items, setItems] = useState<PostRow[] | CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/community/mypage?tab=${tab}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
        return res.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const tabs = [
    { key: "posts" as const, label: "내가 쓴 글" },
    { key: "comments" as const, label: "내가 쓴 댓글" },
    { key: "received-likes" as const, label: "내가 받은 추천" },
    { key: "bookmarks" as const, label: "북마크한 글" },
  ];

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/mypage" className="hover:text-site-primary">마이페이지</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">커뮤니티 활동</span>
        </nav>
        <h1 className="text-xl font-bold mb-6">커뮤니티 활동</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                tab === t.key ? "bg-site-primary text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-500 py-4">불러오는 중…</p>}
        {!loading && tab === "posts" && (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="내가 쓴 글">
            {(items as PostRow[]).length === 0 && (
              <li className="py-10 text-center text-sm text-gray-500">글이 없습니다.</li>
            )}
            {(items as PostRow[]).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/community/posts/${p.id}`}
                  className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-site-text line-clamp-2 leading-snug">{p.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      [{p.boardName}] 추천 {p.likeCount} · 댓글 {p.commentCount} · {formatKoreanDate(p.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 self-start rounded-md border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                    {p.commentCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!loading && tab === "comments" && (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="내가 쓴 댓글">
            {(items as CommentRow[]).length === 0 && (
              <li className="py-10 text-center text-sm text-gray-500">댓글이 없습니다.</li>
            )}
            {(items as CommentRow[]).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/community/posts/${c.postId}#comment-${c.id}`}
                  className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-site-text line-clamp-2 leading-snug">{c.content}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      [{c.boardName}] {c.postTitle} · 추천 {c.likeCount} · {formatKoreanDate(c.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!loading && (tab === "received-likes" || tab === "bookmarks") && (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="글 목록">
            {(items as PostRow[]).length === 0 && (
              <li className="py-10 text-center text-sm text-gray-500">글이 없습니다.</li>
            )}
            {(items as PostRow[]).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/community/posts/${p.id}`}
                  className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-site-text line-clamp-2 leading-snug">{p.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      [{p.boardName}] 추천 {p.likeCount} · 댓글 {p.commentCount} · {formatKoreanDate(p.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 self-start rounded-md border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                    {p.commentCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
