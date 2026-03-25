"use client";

import Link from "next/link";
import { formatCommunityListDate } from "@/lib/format-date";
import { CommunityWriteFab } from "@/components/community/CommunityWriteFab";

type PostItem = {
  id: string;
  title: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  boardSlug: string;
  boardName: string;
};

export function CommunityMainClient({
  latest,
  canManageReports = false,
  showSolverEntry,
}: {
  latest: PostItem[];
  canManageReports?: boolean;
  showSolverEntry: boolean;
}) {
  const postLink = (p: PostItem) =>
    p.boardSlug === "trouble" ? `/community/trouble/${p.id}` : `/community/${p.boardSlug}/${p.id}`;

  const fabHref = showSolverEntry ? "/community/trouble/write" : "/community/free/write";

  const badge = (p: PostItem): "N" | "HOT" | null => {
    if (p.commentCount > 0) return "N";
    if (p.viewCount >= 100) return "HOT";
    return null;
  };

  return (
    <div className="mt-4 space-y-3 pb-20">
      {canManageReports && (
        <div className="flex justify-end">
          <Link href="/community/admin/reports" className="text-sm text-site-primary hover:underline">
            신고 관리
          </Link>
        </div>
      )}

      {/*
        오픈 전 심플 모드:
        - 게시판 통합 최신순만 노출
        - 오늘/주간/추천(인기) UI는 숨김 처리
      */}

      <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="게시글 목록">
        {latest.length === 0 && (
          <li className="py-4 px-1 text-sm text-gray-500">글이 없습니다.</li>
        )}
        {latest.map((p) => (
          <li key={p.id}>
            <Link href={postLink(p)} className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-site-text line-clamp-2 leading-snug">
                  <span className="truncate">{p.title}</span>
                  {badge(p) === "N" ? (
                    <span className="ml-1 inline-flex align-middle text-[11px] font-semibold text-site-primary">N</span>
                  ) : badge(p) === "HOT" ? (
                    <span className="ml-1 inline-flex align-middle text-[11px] font-semibold text-rose-600">HOT</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {p.boardName} · {p.authorName} · {formatCommunityListDate(p.createdAt)} · 조회 {p.viewCount}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-gray-200 dark:border-slate-600 px-2 py-0.5 text-xs text-gray-500 dark:text-slate-400 tabular-nums">
                {p.commentCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <CommunityWriteFab href={fabHref} />
    </div>
  );
}
