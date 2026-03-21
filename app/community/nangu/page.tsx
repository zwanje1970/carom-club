"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatKoreanDate } from "@/lib/format-date";

type NanguPostListItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  authorName: string;
  solutionCount: number;
  solutions: { id: string; title: string | null; authorName: string; voteCount: number; createdAt: string }[];
};

export default function NanguBoardPage() {
  const [posts, setPosts] = useState<NanguPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/community/nangu", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
        return res.json();
      })
      .then(setPosts)
      .catch((e) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">커뮤니티</Link>
          <span aria-hidden>/</span>
          <span className="text-site-text font-medium">난구해결사</span>
        </nav>
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-xl font-bold">난구해결사</h1>
          <Link
            href="/community/nangu/write"
            className="shrink-0 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium"
          >
            글쓰기
          </Link>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          문제구 질문 및 해법 토론용 게시판입니다.
        </p>
        {loading && <p className="text-gray-500">목록 불러오는 중…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p className="text-gray-500">아직 글이 없습니다.</p>
        )}
        {!loading && !error && posts.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="게시글 목록">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/community/nangu/${p.id}`}
                  className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-site-text line-clamp-2 leading-snug">{p.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {p.authorName} · {formatKoreanDate(p.createdAt)} · 해법 {p.solutionCount}개
                    </p>
                  </div>
                  <span className="shrink-0 self-start rounded-md border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                    {p.solutionCount}
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
