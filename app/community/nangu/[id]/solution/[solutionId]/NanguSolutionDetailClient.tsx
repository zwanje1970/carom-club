"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CommunityLevelBadge } from "@/components/community/CommunityLevelBadge";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "@/components/nangu/NanguSolutionPathOverlay";
import { formatKoreanDate } from "@/lib/format-date";
import { DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "@/lib/billiard-table-constants";
import { normalizeBallSpeed } from "@/lib/ball-speed-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NanguSolutionData } from "@/lib/nangu-types";
import { pathsFromTroubleSolutionDataJson } from "@/lib/trouble-solution-data-to-overlay";
import { useSolutionPathPlayback } from "@/hooks/useSolutionPathPlayback";

function formatNumber(value: number | undefined, digits = 2): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function getSettingSummaryItems(data: NanguSolutionData) {
  const railCount = data.settings?.railCount ?? data.speedLevel ?? data.speed;
  const tipX = data.settings?.tipNorm?.x ?? data.tipX ?? data.spinX;
  const tipY = data.settings?.tipNorm?.y ?? data.tipY ?? data.spinY;
  const ballSpeed = data.settings?.ballSpeed ?? data.ballSpeed ?? data.speedLevel ?? data.speed;
  const backstroke = data.settings?.backstroke ?? data.backstrokeLevel;
  const followStroke = data.settings?.followStroke ?? data.followStrokeLevel;

  return [
    { label: "샷 유형", value: data.isBankShot ? "뱅크샷" : "일반" },
    { label: "거리", value: railCount != null ? `${formatNumber(railCount)} 단계` : "-" },
    { label: "두께", value: data.thicknessOffsetX != null ? formatNumber(data.thicknessOffsetX) : "-" },
    {
      label: "당점",
      value:
        tipX != null || tipY != null
          ? `X ${formatNumber(tipX)} / Y ${formatNumber(tipY)}`
          : "-",
    },
    { label: "볼스피드", value: ballSpeed != null ? formatNumber(ballSpeed) : "-" },
    { label: "백스트로크", value: backstroke != null ? formatNumber(backstroke) : "-" },
    { label: "팔로우", value: followStroke != null ? formatNumber(followStroke) : "-" },
  ];
}

type Props = {
  postId: string;
  postTitle: string;
  ballPlacement: NanguBallPlacement;
  isLoggedIn: boolean;
  canVoteGood: boolean;
  canVoteBad: boolean;
  voteBlockedReason: string | null;
  commentFeatureEnabled: boolean;
  canCreateComment: boolean;
  canDeleteOwnComment: boolean;
  solution: {
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
  canAcceptSolution: boolean;
};

export function NanguSolutionDetailClient({
  postId,
  postTitle,
  ballPlacement,
  isLoggedIn,
  canVoteGood,
  canVoteBad,
  voteBlockedReason,
  commentFeatureEnabled,
  canCreateComment,
  canDeleteOwnComment,
  solution: s,
  canAcceptSolution,
}: Props) {
  const router = useRouter();
  const [voteLoading, setVoteLoading] = useState(false);
  const [adoptLoading, setAdoptLoading] = useState(false);

  const handleVote = async (vote: "good" | "bad") => {
    setVoteLoading(true);
    try {
      const res = await fetch(`/api/community/nangu/solutions/${s.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vote }),
      });
      if (res.ok) router.refresh();
    } finally {
      setVoteLoading(false);
    }
  };

  const handleAdopt = async () => {
    setAdoptLoading(true);
    try {
      const res = await fetch(`/api/community/nangu/${postId}/solutions/${s.id}/adopt`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setAdoptLoading(false);
    }
  };

  const bodyText =
    s.comment?.trim() ||
    s.data.explanationText?.trim() ||
    "";
  const settingSummaryItems = getSettingSummaryItems(s.data);
  const overlay = pathsFromTroubleSolutionDataJson(s.data as unknown as Record<string, unknown>);
  const cuePos =
    ballPlacement.cueBall === "yellow" ? ballPlacement.yellowBall : ballPlacement.whiteBall;
  const playbackBallSpeed = normalizeBallSpeed(
    s.data.settings?.railCount != null
      ? Number(s.data.settings.railCount)
      : Number(s.data.ballSpeed ?? s.data.speedLevel ?? s.data.speed ?? 3)
  );
  const pathPlayback = useSolutionPathPlayback({
    ballPlacement,
    pathPoints: overlay.pathPoints,
    objectPathPoints: overlay.objectPathPoints,
    ballSpeed: playbackBallSpeed,
    isBankShot: Boolean(s.data.isBankShot),
    thicknessOffsetX: typeof s.data.thicknessOffsetX === "number" ? s.data.thicknessOffsetX : 0.5,
    ignorePhysics: Boolean(s.data.settings?.ignorePhysics),
    cuePathCurveControls: overlay.cuePathDisplayCurves,
    cuePathCurveNodes: overlay.cuePathCurveNodes,
    objectPathCurveControls: overlay.objectPathDisplayCurves,
    objectPathCurveNodes: overlay.objectPathCurveNodes,
    collisionWarningsEnabled: false,
    playbackRate: 1,
  });
  const mergedBallNormOverridesForCanvas = useMemo(() => {
    return pathPlayback.ballNormOverrides ?? undefined;
  }, [pathPlayback.ballNormOverrides]);
  const cuePosWithPlayback = useMemo(() => {
    const k = ballPlacement.cueBall === "yellow" ? "yellow" : "white";
    if (pathPlayback.isPlaybackActive) {
      const pb = pathPlayback.ballNormOverridesLiveRef.current;
      return pb?.[k] ?? cuePos;
    }
    const pb = pathPlayback.ballNormOverrides;
    if (!pb) return cuePos;
    return pb[k] ?? cuePos;
  }, [
    cuePos,
    ballPlacement.cueBall,
    pathPlayback.isPlaybackActive,
    pathPlayback.ballNormOverrides,
    pathPlayback.ballNormOverridesLiveRef,
  ]);
  const handlePlayTap = useCallback(() => {
    if (pathPlayback.isPlaybackActive) {
      pathPlayback.resetPlayback();
      return;
    }
    if (!pathPlayback.canPlayback) return;
    pathPlayback.startPlayback();
  }, [pathPlayback]);
  const playbackStatusText = pathPlayback.stoppedOnCollision
    ? "재생이 충돌 경고로 중단되었습니다."
    : pathPlayback.isPlaybackActive
      ? pathPlayback.playbackPhase === "object"
        ? "목적구 이동 재생 중"
        : "수구 이동 재생 중"
      : pathPlayback.ballNormOverrides
        ? "재생 종료, 최종 위치를 잠시 유지 중입니다."
        : "저장된 경로 기준으로 재생할 수 있습니다.";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">문제 게시글</p>
          <p className="text-sm text-site-text line-clamp-2">{postTitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-site-text">{s.authorName}</span>
          <CommunityLevelBadge
            level={s.authorLevel}
            tierName={s.authorTierName}
            tierColor={s.authorTierColor}
            size="sm"
          />
          <span>· {formatKoreanDate(s.createdAt)}</span>
          {s.isAdopted && (
            <span className="text-xs px-2 py-0.5 rounded bg-site-primary/20 text-site-primary font-medium">
              채택
            </span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-site-text">공배치와 해법 경로</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            공은 문제 배치, 선은 해법 표현입니다. 저장된 경로를 기준으로 읽기 전용 재생만 지원합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePlayTap}
            disabled={!pathPlayback.canPlayback && !pathPlayback.isPlaybackActive}
            className="px-3 py-1.5 rounded-lg bg-site-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {pathPlayback.isPlaybackActive ? "재생 중지" : "경로 재생"}
          </button>
          <button
            type="button"
            onClick={pathPlayback.resetPlayback}
            disabled={!pathPlayback.isPlaybackActive && !pathPlayback.ballNormOverrides}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-site-text text-sm disabled:opacity-50"
          >
            위치 초기화
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {playbackStatusText}
          </p>
        </div>
        <div
          className="relative rounded-lg overflow-hidden bg-site-bg w-full max-w-full mx-auto"
          style={{
            maxWidth: DEFAULT_TABLE_WIDTH,
            aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
        >
          <div className="absolute inset-0 z-0 pointer-events-none">
            <NanguReadOnlyLayout
              ballPlacement={ballPlacement}
              ballNormOverrides={mergedBallNormOverridesForCanvas}
              ballNormOverridesLiveRef={pathPlayback.ballNormOverridesLiveRef}
              playbackBallAnimActive={pathPlayback.isPlaybackActive}
              fillContainer
              embedFill
              className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
              showGrid
              showCueBallSpot={!pathPlayback.isPlaybackActive}
              drawStyle="realistic"
              betweenTableAndBallsLayer={
                <NanguSolutionPathOverlay
                  pathPoints={overlay.pathPoints}
                  cuePos={cuePosWithPlayback}
                  tableBallPlacement={ballPlacement}
                  ballPickLayout={ballPlacement}
                  ballNormOverrides={mergedBallNormOverridesForCanvas}
                  objectPathPoints={overlay.objectPathPoints}
                  pathMode={false}
                  objectPathMode={false}
                  pathLinesVisible
                  pathPlaybackActive={pathPlayback.isPlaybackActive}
                  cueDisplayCurveControls={overlay.cuePathDisplayCurves}
                  objectDisplayCurveControls={overlay.objectPathDisplayCurves}
                  cuePathCurveNodes={overlay.cuePathCurveNodes}
                  objectPathCurveNodes={overlay.objectPathCurveNodes}
                  curveHandleInteraction={false}
                  curveHandlesShowSubtle={false}
                />
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            문제 배치
          </span>
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            수구 경로선
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            목적구 경로선
          </span>
        </div>
        {pathPlayback.stoppedOnCollision && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            재생이 중단되었습니다. 저장된 경로선은 유지되며, 버튼으로 다시 재생하거나 위치를 초기화할 수 있습니다.
          </p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3">
          <h2 className="text-base font-semibold text-site-text">설명</h2>
          {bodyText ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{bodyText}</p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">작성된 설명이 없습니다.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3">
          <h2 className="text-base font-semibold text-site-text">설정값 요약</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {settingSummaryItems.map((item) => (
              <React.Fragment key={item.label}>
                <dt className="text-gray-500 dark:text-gray-400">{item.label}</dt>
                <dd className="text-site-text text-right tabular-nums">{item.value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-site-text">평가와 채택</h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 tabular-nums">
            GOOD {s.goodCount} · BAD {s.badCount} · 순추천 {s.voteCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.isAdopted && (
            <span className="px-3 py-1.5 rounded-lg bg-site-primary/15 text-site-primary text-sm font-medium">
              질문자가 채택한 해법
            </span>
          )}
          {canAcceptSolution && !s.isAdopted && (
            <button
              type="button"
              onClick={handleAdopt}
              disabled={adoptLoading}
              className="px-3 py-1.5 rounded-lg border border-site-primary text-site-primary text-sm font-medium disabled:opacity-50"
            >
              {adoptLoading ? "처리 중…" : "질문자 채택"}
            </button>
          )}
          {canVoteGood && (
            <button
              type="button"
              onClick={() => handleVote("good")}
              disabled={voteLoading}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-site-text text-sm disabled:opacity-50"
            >
              {voteLoading ? "…" : "GOOD"}
            </button>
          )}
          {canVoteBad && (
            <button
              type="button"
              onClick={() => handleVote("bad")}
              disabled={voteLoading}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-site-text text-sm disabled:opacity-50"
            >
              {voteLoading ? "…" : "BAD"}
            </button>
          )}
          <Link
            href={`/community/nangu/${postId}/solution/${s.id}/edit`}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-site-text text-sm"
          >
            수정
          </Link>
        </div>
        {!canVoteGood && !canVoteBad && voteBlockedReason && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{voteBlockedReason}</p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-site-text">댓글</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            해법 전용 댓글 모델과 API가 아직 연결되지 않아, 권한이 있어도 현재는 해법 상세에서 댓글을 저장하거나 삭제할 수 없습니다.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
          등록된 댓글이 없습니다.
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
          <p>{commentFeatureEnabled ? "사이트 댓글 기능은 켜져 있습니다." : "사이트 댓글 기능이 현재 비활성화되어 있습니다."}</p>
          <p>{isLoggedIn ? (canCreateComment ? "현재 사용자에게 일반 댓글 작성 권한이 있습니다." : "현재 사용자에게 일반 댓글 작성 권한이 없습니다.") : "로그인해야 일반 댓글 권한을 확인할 수 있습니다."}</p>
          <p>{isLoggedIn ? (canDeleteOwnComment ? "현재 사용자에게 본인 댓글 삭제 권한이 있습니다." : "현재 사용자에게 본인 댓글 삭제 권한이 없습니다.") : "본인 댓글 삭제 권한은 로그인 후 확인됩니다."}</p>
        </div>
      </section>
    </div>
  );
}
