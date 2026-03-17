"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BilliardTableCanvas } from "@/components/billiard";
import { NanguSolutionLayerCanvas } from "@/components/nangu/NanguSolutionLayerCanvas";
import { CommunityLevelBadge } from "@/components/community/CommunityLevelBadge";
import { DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "@/lib/billiard-table-constants";
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
  };
  solutions: SolutionItem[];
}) {
  const [expandedSolutionId, setExpandedSolutionId] = useState<string | null>(null);

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
        <span>· {new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
      </p>
      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{post.content}</p>

      <section aria-labelledby="nangu-problem-table">
        <h2 id="nangu-problem-table" className="sr-only">문제 공배치</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          원본 공배치 (게시 후 수정 불가, 보기 전용)
        </p>
        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50">
          <BilliardTableCanvas
            redBall={post.ballPlacement.redBall}
            yellowBall={post.ballPlacement.yellowBall}
            whiteBall={post.ballPlacement.whiteBall}
            cueBall={post.ballPlacement.cueBall}
            interactive={false}
            showGrid={true}
          />
        </div>
      </section>

      <section aria-labelledby="nangu-solutions">
        <div className="flex items-center justify-between gap-4">
          <h2 id="nangu-solutions" className="text-lg font-semibold">해법 ({solutions.length})</h2>
          <Link
            href={`/community/nangu/${post.id}/solution/new`}
            className="shrink-0 py-2 px-4 rounded-lg bg-site-primary text-white text-sm font-medium"
          >
            해법 제시
          </Link>
        </div>
        {solutions.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-sm">아직 해법이 없습니다.</p>
        )}
        <ul className="space-y-4">
          {solutions.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedSolutionId(expandedSolutionId === s.id ? null : s.id)}
                className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <span className="font-medium text-site-text flex items-center gap-2">
                  {s.isAdopted && (
                    <span className="text-xs px-2 py-0.5 rounded bg-site-primary/20 text-site-primary font-medium">
                      채택
                    </span>
                  )}
                  {s.title ?? "해법"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span>{s.authorName}</span>
                  <CommunityLevelBadge
                    level={s.authorLevel ?? 1}
                    tierName={s.authorTierName ?? "입문"}
                    tierColor={s.authorTierColor}
                    size="sm"
                  />
                  <span>· 추천 {s.voteCount}</span>
                </span>
              </button>
              {expandedSolutionId === s.id && (
                <div className="border-t border-gray-200 dark:border-slate-600 p-4">
                  {s.comment && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
                      {s.comment}
                    </p>
                  )}
                  <div
                    className="relative rounded-lg overflow-hidden bg-site-bg w-full max-w-full"
                    style={{
                      maxWidth: DEFAULT_TABLE_WIDTH,
                      aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
                    }}
                  >
                    <BilliardTableCanvas
                      width={DEFAULT_TABLE_WIDTH}
                      height={DEFAULT_TABLE_HEIGHT}
                      redBall={post.ballPlacement.redBall}
                      yellowBall={post.ballPlacement.yellowBall}
                      whiteBall={post.ballPlacement.whiteBall}
                      cueBall={post.ballPlacement.cueBall}
                      interactive={false}
                      showGrid={true}
                    />
                    <NanguSolutionLayerCanvas
                      width={DEFAULT_TABLE_WIDTH}
                      height={DEFAULT_TABLE_HEIGHT}
                      data={s.data}
                      className="pointer-events-none absolute inset-0"
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
