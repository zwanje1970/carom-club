"use client";

import Link from "next/link";
import { CommunityLevelBadge } from "@/components/community/CommunityLevelBadge";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { formatKoreanDate } from "@/lib/format-date";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement, NanguSolutionData } from "@/lib/nangu-types";

export type NanguSolutionSummaryCardItem = {
  id: string;
  title: string | null;
  comment: string | null;
  data: NanguSolutionData;
  goodCount: number;
  badCount: number;
  isAdopted: boolean;
  createdAt: string;
  authorName: string;
  authorLevel: number;
  authorTierName: string;
  authorTierColor: string;
};

/** 카드 요약용: DB comment 또는 data.explanationText */
export function getNanguSolutionExcerpt(
  comment: string | null | undefined,
  data: NanguSolutionData,
  maxLen = 140
): string {
  const raw = (comment?.trim() || data?.explanationText?.trim() || "")
    .replace(/\s+/g, " ");
  if (!raw) return "설명 없음";
  return raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw;
}

type Props = {
  postId: string;
  ballPlacement: NanguBallPlacement;
  solution: NanguSolutionSummaryCardItem;
  canAcceptSolution: boolean;
  adoptLoading: string | null;
  voteLoading: string | null;
  onVote: (solutionId: string, vote: "good" | "bad") => void;
  onAdopt: (solutionId: string) => void;
};

/**
 * 해법 목록용 요약 카드. 본문 영역은 상세로 이동, 하단 액션은 기존 API 호출 유지.
 */
export function NanguSolutionSummaryCard({
  postId,
  ballPlacement,
  solution: s,
  canAcceptSolution,
  adoptLoading,
  voteLoading,
  onVote,
  onAdopt,
}: Props) {
  const detailHref = `/community/nangu/${postId}/solution/${s.id}`;
  const excerpt = getNanguSolutionExcerpt(s.comment, s.data);

  return (
    <li className="rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden flex flex-col">
      <Link
        href={detailHref}
        className="block p-4 text-left hover:bg-gray-50/80 dark:hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-site-primary/40 rounded-t-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-site-text flex flex-wrap items-center gap-2 min-w-0">
            {s.isAdopted && (
              <span className="text-xs px-2 py-0.5 rounded bg-site-primary/20 text-site-primary font-medium shrink-0">
                채택
              </span>
            )}
            <span className="line-clamp-2">{s.title ?? "해법"}</span>
          </h3>
        </div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <div className="shrink-0 w-full max-w-[200px] mx-auto sm:mx-0">
            <p className="text-[10px] text-gray-500 dark:text-gray-500 mb-1 sm:sr-only">
              해법 공배치
            </p>
            <div
              className="relative w-full overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
              style={{
                aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
              }}
            >
              <NanguReadOnlyLayout
                ballPlacement={ballPlacement}
                fillContainer
                embedFill
                orientation="landscape"
                showGrid={false}
                drawStyle="realistic"
                showCueBallSpot
                className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
          <span className="font-medium text-site-text">{s.authorName}</span>
          <CommunityLevelBadge
            level={s.authorLevel ?? 1}
            tierName={s.authorTierName ?? "입문"}
            tierColor={s.authorTierColor}
            size="sm"
          />
          <span>· {formatKoreanDate(s.createdAt)}</span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">
          {excerpt}
        </p>
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-500 tabular-nums">
          GOOD {s.goodCount} · BAD {s.badCount}
          {s.isAdopted ? " · 채택됨" : ""}
        </p>
        <p className="mt-2 text-xs text-site-primary">상세 보기 →</p>
          </div>
        </div>
      </Link>

      <div
        className="border-t border-gray-200 dark:border-slate-600 px-4 py-3 flex flex-wrap items-center gap-2 bg-gray-50/50 dark:bg-slate-900/30"
        onClick={(e) => e.stopPropagation()}
      >
        {canAcceptSolution && !s.isAdopted && (
          <button
            type="button"
            onClick={() => onAdopt(s.id)}
            disabled={!!adoptLoading}
            className="px-3 py-1.5 rounded-lg border border-site-primary text-site-primary text-sm font-medium disabled:opacity-50"
          >
            {adoptLoading === s.id ? "처리 중…" : "질문자 채택"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onVote(s.id, "good")}
          disabled={!!voteLoading}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-site-text text-sm disabled:opacity-50"
        >
          {voteLoading === s.id ? "…" : "GOOD"}
        </button>
        <button
          type="button"
          onClick={() => onVote(s.id, "bad")}
          disabled={!!voteLoading}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-site-text text-sm disabled:opacity-50"
        >
          {voteLoading === s.id ? "…" : "BAD"}
        </button>
      </div>
    </li>
  );
}
