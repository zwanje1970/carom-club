"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCommunityListDate } from "@/lib/format-date";
import { CommunityBoardTabBar } from "@/components/community/CommunityBoardTabBar";
import { CommunityPopularPills, type PopularPillKey } from "@/components/community/CommunityPopularPills";
import { CommunityWriteFab } from "@/components/community/CommunityWriteFab";
import { orderedHubBoards } from "@/components/community/communityBoardConstants";

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

type Popular = {
  today: PostItem[];
  weekly: PostItem[];
  mostLiked: PostItem[];
  mostComments: PostItem[];
};

export function CommunityMainClient({
  boards,
  popular,
  canManageReports = false,
}: {
  boards: { id: string; slug: string; name: string; type?: string }[];
  popular: Popular;
  canManageReports?: boolean;
}) {
  const hubBoards = orderedHubBoards(boards);
  const [popularTab, setPopularTab] = useState<PopularPillKey>("today");

  const postLink = (p: PostItem) =>
    p.boardSlug === "trouble" ? `/community/trouble/${p.id}` : `/community/${p.boardSlug}/${p.id}`;

  const popularData =
    popular[
      popularTab === "liked" ? "mostLiked" : popularTab === "comments" ? "mostComments" : popularTab === "weekly" ? "weekly" : "today"
    ];

  const fabHref = hubBoards[0]?.slug
    ? hubBoards[0].slug === "trouble"
      ? "/community/trouble/write"
      : `/community/${hubBoards[0].slug}/write`
    : "/community/free/write";

  return (
    <div className="mt-4 space-y-3 pb-20">
      {canManageReports && (
        <div className="flex justify-end">
          <Link href="/community/admin/reports" className="text-sm text-site-primary hover:underline">
            신고 관리
          </Link>
        </div>
      )}

      <CommunityBoardTabBar boards={hubBoards} />

      <CommunityPopularPills value={popularTab} onChange={setPopularTab} className="mt-2" />

      <ul className="divide-y divide-gray-200 dark:divide-slate-700" aria-label="게시글 목록">
        {popularData.length === 0 && (
          <li className="py-4 px-1 text-sm text-gray-500">글이 없습니다.</li>
        )}
        {popularData.map((p) => (
          <li key={p.id}>
            <Link href={postLink(p)} className="flex items-start gap-3 py-3.5 px-1 hover:bg-gray-50/80 dark:hover:bg-slate-800/40">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-site-text line-clamp-2 leading-snug">{p.title}</p>
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
