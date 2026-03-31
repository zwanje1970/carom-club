"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatKoreanDate } from "@/lib/format-date";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import { NanguSolutionSummaryCard } from "@/components/nangu/NanguSolutionSummaryCard";
import { CommunityLevelBadge } from "@/components/community/CommunityLevelBadge";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";

type SolutionItem = {
  id: string;
  title: string | null;
  comment: string | null;
  data: NanguSolutionData;
  voteCount: number;
  goodCount: number;
  badCount: number;
  isAdopted: boolean;
  createdAt: string;
  authorName: string;
  authorLevel: number;
  authorTierName: string;
  authorTierColor: string;
};

export function NanguPostDetailClient({
  post,
  solutions,
}: {
  post: {
    id: string;
    authorName: string;
    authorLevel?: number;
    authorTierName?: string;
    authorTierColor?: string;
    title: string;
    content: string;
    ballPlacement: NanguBallPlacement;
    createdAt: string;
    isAuthor: boolean;
    canDeletePost: boolean;
    canCreateSolution: boolean;
    canAcceptSolution: boolean;
  };
  solutions: SolutionItem[];
}) {
  const router = useRouter();
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [adoptLoading, setAdoptLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleVote = async (solutionId: string, vote: "good" | "bad") => {
    setVoteLoading(solutionId);
    try {
      const res = await fetch(`/api/community/nangu/solutions/${solutionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vote }),
      });
      if (res.ok) router.refresh();
    } finally {
      setVoteLoading(null);
    }
  };

  const handleAdopt = async (solutionId: string) => {
    setAdoptLoading(solutionId);
    try {
      const res = await fetch(`/api/community/nangu/${post.id}/solutions/${solutionId}/adopt`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setAdoptLoading(null);
    }
  };

  const handleDeletePost = async () => {
    if (deleteLoading) return;
    if (!confirm("게시글을 삭제할까요?")) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/community/nangu/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        router.push("/community/nangu");
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(data?.error ?? "게시글 삭제에 실패했습니다.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
        <span>{post.authorName}</span>
        {post.authorLevel != null && (
          <CommunityLevelBadge
            level={post.authorLevel}
            tierName={post.authorTierName ?? "입문"}
            tierColor={post.authorTierColor}
            size="sm"
          />
        )}
        <span>· {formatKoreanDate(post.createdAt)}</span>
      </p>

      <section aria-labelledby="nangu-problem-layout-viewer" className="space-y-2">
        <h2 id="nangu-problem-layout-viewer" className="sr-only">
          문제 공배치
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          문제 공배치 (읽기 전용 · 게시글에 저장된 원본)
        </p>
        <div
          className="relative w-full overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
          style={{
            maxWidth: DEFAULT_TABLE_WIDTH,
            aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
        >
          <NanguReadOnlyLayout
            ballPlacement={post.ballPlacement}
            fillContainer
            embedFill
            className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
            showGrid
            drawStyle="realistic"
            showCueBallSpot
            orientation="landscape"
          />
        </div>
      </section>

      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{post.content}</p>

      {post.canDeletePost && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDeletePost}
            disabled={deleteLoading}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-60"
          >
            {deleteLoading ? "삭제 중…" : "게시글 삭제"}
          </button>
        </div>
      )}

      <section aria-labelledby="nangu-solutions">
        <div className="flex items-center justify-between gap-4">
          <h2 id="nangu-solutions" className="text-lg font-semibold">해법 ({solutions.length})</h2>
          {post.canCreateSolution && (
            <Link
              href={`/community/nangu/${post.id}/solve`}
              className="shrink-0 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium"
            >
              해법 제시
            </Link>
          )}
        </div>
        {solutions.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-sm">아직 해법이 없습니다.</p>
        )}
        <ul className="grid gap-4 sm:grid-cols-1" role="list">
          {solutions.map((s) => (
            <NanguSolutionSummaryCard
              key={s.id}
              postId={post.id}
              ballPlacement={post.ballPlacement}
              solution={s}
              canAcceptSolution={post.canAcceptSolution}
              adoptLoading={adoptLoading}
              voteLoading={voteLoading}
              onVote={handleVote}
              onAdopt={handleAdopt}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
