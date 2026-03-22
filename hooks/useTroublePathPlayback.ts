"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  getPlayfieldRect,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import { ballSpeedToLegacySpeed, ballSpeedToLegacySpeedLevel } from "@/lib/ball-speed-constants";
import type { BallSpeed } from "@/lib/ball-speed-constants";
import type { NormPoint } from "@/lib/path-motion-geometry";
import {
  collectInitialTouchingBallPairs,
  cuePhaseCollisionWithOthers,
  objectPhaseCollisionWithOthers,
} from "@/lib/path-playback-collision";
import type {
  NanguBallPlacement,
  NanguPathPoint,
  NanguSolutionData,
} from "@/lib/nangu-types";
import {
  PATH_ANIMATION_TIMING,
  computePolylinePlaybackDurationMs,
  cuePathDecelerationProgress,
  cuePlaybackMovementTauMsFromWallMs,
  cuePlaybackTauFractionAtCumulativeDistance,
  cuePlaybackWallDurationWithSpotPausesMs,
} from "@/lib/path-animation-timing";
import { polylineSegmentLengthsPx } from "@/lib/path-motion-geometry";
import {
  buildCuePathMotionPlan,
  buildObjectPathMotionPlan,
  buildObjectPathMotionPlanWithStartVertex,
  sampleCueMotion,
  sampleObjectMotion,
  truncateCuePathPlanAtLastBallSpotForPlayback,
} from "@/lib/solution-path-motion";
import {
  cueFirstObjectHitFromBallPlacement,
} from "@/lib/solution-path-geometry";

export const COLLISION_POPUP_MESSAGE = "충돌이 발생하였습니다." as const;

export type BallNormOverrides = Partial<Record<"red" | "yellow" | "white", NormPoint>>;

function ballCenterNormForKey(
  placement: NanguBallPlacement,
  key: "red" | "yellow" | "white"
): NormPoint {
  if (key === "red") return { x: placement.redBall.x, y: placement.redBall.y };
  if (key === "yellow") return { x: placement.yellowBall.x, y: placement.yellowBall.y };
  return { x: placement.whiteBall.x, y: placement.whiteBall.y };
}

function buildPlaybackSolutionData(params: {
  ballPlacement: NanguBallPlacement;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  ballSpeed: BallSpeed;
  isBankShot: boolean;
  thicknessOffsetX: number;
  rect: PlayfieldRect;
}): NanguSolutionData | null {
  const { ballPlacement, pathPoints, objectPathPoints, ballSpeed, isBankShot, thicknessOffsetX, rect } =
    params;
  if (pathPoints.length < 1) return null;

  const cuePos =
    ballPlacement.cueBall === "yellow" ? ballPlacement.yellowBall : ballPlacement.whiteBall;
  const pointsForPath = pathPoints.map((p) => ({ x: p.x, y: p.y }));
  const firstHit = cueFirstObjectHitFromBallPlacement(cuePos, pathPoints[0], ballPlacement, rect);
  const collisionNorm = firstHit?.collision ?? null;
  const struckKey = firstHit?.objectKey;

  let reflectionPath: NanguSolutionData["reflectionPath"];
  /** points[0] = 1목 **중심** (접촉 시 수구 중심 좌표가 아님 — 그렇지 않으면 재생 시 1목이 수구 방향으로 먼저 움직임) */
  if (collisionNorm && objectPathPoints.length >= 1 && struckKey) {
    const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
    const startNorm = ballCenterNormForKey(ballPlacement, struckKey);
    reflectionPath = {
      points: [{ x: startNorm.x, y: startNorm.y }, ...objPts],
      pointsWithType: objectPathPoints,
    };
  }

  return {
    isBankShot,
    thicknessOffsetX: isBankShot ? undefined : thicknessOffsetX,
    tipX: 0,
    tipY: 0,
    spinX: 0,
    spinY: 0,
    paths: [{ points: pointsForPath, pointsWithType: pathPoints }],
    reflectionPath,
    /** 재생 시 경로를 따라 움직일 공 — 미지정 시 red로 잘못 잡혀 1목이 안 움직인 것처럼 보임 */
    reflectionObjectBall: reflectionPath ? struckKey : undefined,
    ballSpeed,
    speedLevel: ballSpeedToLegacySpeedLevel(ballSpeed),
    speed: ballSpeedToLegacySpeed(ballSpeed),
  };
}

export function useTroublePathPlayback(options: {
  ballPlacement: NanguBallPlacement | null;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  ballSpeed: BallSpeed;
  isBankShot: boolean;
  thicknessOffsetX: number;
  width?: number;
  height?: number;
  /**
   * false면 재생 중 충돌 팝업 비활성화.
   * 「1목적구 경로선 그리기」를 켜고 1목 스팟이 1개 이상일 때만 true로 두는 것을 권장.
   */
  collisionWarningsEnabled?: boolean;
}): {
  ballNormOverrides: BallNormOverrides | null;
  playbackPhase: "idle" | "cue" | "object";
  collisionMessage: string | null;
  dismissCollisionMessage: () => void;
  startPlayback: () => void;
  resetPlayback: () => void;
  canPlayback: boolean;
  isPlaybackActive: boolean;
  stoppedOnCollision: boolean;
} {
  const width = options.width ?? DEFAULT_TABLE_WIDTH;
  const height = options.height ?? DEFAULT_TABLE_HEIGHT;
  const rect = useMemo(() => getPlayfieldRect(width, height), [width, height]);
  const collisionWarningsEnabled = options.collisionWarningsEnabled ?? false;

  const playbackData = useMemo(() => {
    if (!options.ballPlacement) return null;
    return buildPlaybackSolutionData({
      ballPlacement: options.ballPlacement,
      pathPoints: options.pathPoints,
      objectPathPoints: options.objectPathPoints,
      ballSpeed: options.ballSpeed,
      isBankShot: options.isBankShot,
      thicknessOffsetX: options.thicknessOffsetX,
      rect,
    });
  }, [
    options.ballPlacement,
    options.pathPoints,
    options.objectPathPoints,
    options.ballSpeed,
    options.isBankShot,
    options.thicknessOffsetX,
    rect,
  ]);

  const cuePlan = useMemo(() => {
    if (!options.ballPlacement || !playbackData) return null;
    return buildCuePathMotionPlan(options.ballPlacement, playbackData, rect, {
      visualizationPlayback: true,
    });
  }, [options.ballPlacement, playbackData, rect]);

  /**
   * 시연 재생 ms — **빨간·파란 길이를 섞지 않음**
   * - `cueDurationMs`: 전체 빨간 `cuePlan.pathLengthPx`. 파란 경로가 있어도 수구는 1목 스팟에서 끊지 않고 끝까지 진행.
   * - `objectDurationMs`: **파란** 1목 폴리라인만.
   */
  const visualizationPlaybackTiming = useMemo(() => {
    if (!cuePlan || !playbackData) return null;
    const rpPts = playbackData.reflectionPath?.points;
    const hasObjectPath = Boolean(rpPts && rpPts.length >= 2);
    const redCuePathLengthPx = cuePlan.pathLengthPx;
    const cueDurationMs = Math.max(
      1,
      Math.round(computePolylinePlaybackDurationMs(redCuePathLengthPx, rect))
    );
    const objPlan = hasObjectPath
      ? buildObjectPathMotionPlan(playbackData, rect, { visualizationPlayback: true })
      : null;
    const blueObjectPathLengthPx = objPlan?.pathLengthPx ?? 0;
    const combinedLenPx = redCuePathLengthPx + blueObjectPathLengthPx;
    if (!hasObjectPath || blueObjectPathLengthPx <= 0) {
      return { cueDurationMs, objectDurationMs: 0, combinedLenPx };
    }
    const objectDurationMs = Math.max(
      1,
      Math.round(computePolylinePlaybackDurationMs(blueObjectPathLengthPx, rect))
    );
    return { cueDurationMs, objectDurationMs, combinedLenPx };
  }, [cuePlan, playbackData, rect]);

  const [ballNormOverrides, setBallNormOverrides] = useState<BallNormOverrides | null>(null);
  const [playbackPhase, setPlaybackPhase] = useState<"idle" | "cue" | "object">("idle");
  const [collisionMessage, setCollisionMessage] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  const cancelRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const resetPlayback = useCallback(() => {
    cancelRaf();
    setBallNormOverrides(null);
    setPlaybackPhase("idle");
  }, [cancelRaf]);

  const dismissCollisionMessage = useCallback(() => {
    setCollisionMessage(null);
  }, []);

  useEffect(() => {
    resetPlayback();
    setCollisionMessage(null);
  }, [
    options.pathPoints,
    options.objectPathPoints,
    options.ballPlacement,
    options.ballSpeed,
    options.isBankShot,
    options.thicknessOffsetX,
    resetPlayback,
  ]);

  useEffect(() => () => cancelRaf(), [cancelRaf]);

  const startPlayback = useCallback(() => {
    const placement = options.ballPlacement;
    if (!placement || !playbackData || !cuePlan) return;
    cancelRaf();
    setCollisionMessage(null);
    /** 재생은 항상 배치 기준 시작점에서 시작 */
    setBallNormOverrides(null);
    setPlaybackPhase("cue");
    const cueMoveDurationMs = Math.max(
      1,
      Math.round(visualizationPlaybackTiming?.cueDurationMs ?? cuePlan.animationDurationMs ?? 1000)
    );
    const hasReflectionPath =
      Boolean(playbackData.reflectionPath?.points) &&
      (playbackData.reflectionPath!.points!.length >= 2);
    /** 1목 스팟에서 수구를 끊지 않음 — 전체 빨간 스팟마다 pause·τ 정렬 */
    const numSpotsForPause = options.pathPoints.length;
    const pauseMs = PATH_ANIMATION_TIMING.cuePlaybackSpotPauseMs;
    /**
     * 빨간 경로만: 수구 → 마지막 빨간 스팟까지 **전 구간**이 `progress` 0→1 한 번의 감속(`cuePathDecelerationProgress`)에 대응.
     * 첫 스팟 구간만이 아니라, 세그먼트 합 = `redPathLengthPx`(파란 경로·거리 제외).
     */
    const segmentLens = polylineSegmentLengthsPx(cuePlan.polylineNormalized, rect);
    const redPathLengthPx = cuePlan.pathLengthPx;
    const numRedSegments = Math.min(numSpotsForPause, segmentLens.length);
    /**
     * 누적 거리 비율 F(빨간 총거리 대비) → τ 비율: `cuePlaybackTauFractionAtCumulativeDistance`(역감속).
     * 스팟 멈춤은 벽시계만 추가(`cuePlaybackMovementTauMsFromWallMs`).
     */
    const tauAtVertices: number[] = [0];
    if (redPathLengthPx > 0 && numRedSegments > 0) {
      let cumLen = 0;
      for (let i = 0; i < numRedSegments; i++) {
        cumLen += segmentLens[i] ?? 0;
        const F = Math.min(1, Math.max(0, cumLen / redPathLengthPx));
        const tauFr = cuePlaybackTauFractionAtCumulativeDistance(F);
        tauAtVertices.push(cueMoveDurationMs * tauFr);
      }
    } else {
      tauAtVertices.push(cueMoveDurationMs);
    }
    const cueWallDurationMs = cuePlaybackWallDurationWithSpotPausesMs(
      cueMoveDurationMs,
      numRedSegments,
      pauseMs,
      false
    );
    const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
    const start = performance.now();
    const initialTouchingPairs = collectInitialTouchingBallPairs(placement, rect);

    const lastCueVertex =
      cuePlan.polylineNormalized[cuePlan.polylineNormalized.length - 1]!;

    /** 수구가 1목(마지막 ball 스팟)에 닿는 순간까지의 경로 길이 비율 → `progress`가 이 값 이상이면 1목 파란 경로 시작 */
    const cueToContact = hasReflectionPath
      ? truncateCuePathPlanAtLastBallSpotForPlayback(cuePlan, options.pathPoints, rect, true)
      : null;
    const dTotal = cuePlan.pathLengthPx;
    const dContact =
      cueToContact && cueToContact.pathLengthPx > 0 ? cueToContact.pathLengthPx : dTotal;
    const pContact = dTotal > 0 ? Math.min(1, dContact / dTotal) : 1;

    /** 파란 경로 시작점: 1목 중심(수구 위치와 독립) */
    let objectPathStartNorm: NormPoint;
    if (
      playbackData.reflectionPath?.points &&
      playbackData.reflectionPath.points.length >= 2 &&
      playbackData.reflectionObjectBall
    ) {
      objectPathStartNorm = ballCenterNormForKey(placement, playbackData.reflectionObjectBall);
    } else if (playbackData.reflectionPath?.points?.[0]) {
      const p0 = playbackData.reflectionPath.points[0];
      objectPathStartNorm = { x: p0.x, y: p0.y };
    } else {
      objectPathStartNorm = lastCueVertex;
    }

    const objPlan =
      hasReflectionPath && playbackData.reflectionObjectBall
        ? buildObjectPathMotionPlanWithStartVertex(playbackData, objectPathStartNorm, rect, {
            visualizationPlayback: true,
          })
        : null;
    const objectDurationMs = Math.max(1, Math.round(visualizationPlaybackTiming?.objectDurationMs ?? 1000));
    const movingKey = (playbackData.reflectionObjectBall ?? "red") as "red" | "yellow" | "white";

    let objectStarted = false;
    let objectStartTime = 0;

    /**
     * 스위치(1목과의 의도된 첫 접촉): 수구 광선상 먼저 맞는 1목 후보 — 수구 구간 전체에서 해당 공과의 맞닿음은 충돌로 보지 않음.
     * (스팟 근처 8px 조건은 표시 좌표·스팟 보정 차로 오탐이 나와 제거함.)
     */
    const cuePosStart =
      placement.cueBall === "yellow" ? placement.yellowBall : placement.whiteBall;
    const firstHitInfo = cueFirstObjectHitFromBallPlacement(
      cuePosStart,
      options.pathPoints[0]!,
      placement,
      rect
    );
    const switchIgnoreKey = firstHitInfo?.objectKey;

    const stepPlayback = (now: number) => {
      const wallMs = now - start;
      const cueDone = wallMs >= cueWallDurationMs;
      const cueWall = Math.min(cueWallDurationMs, wallMs);
      const tauMs = cuePlaybackMovementTauMsFromWallMs(cueWall, tauAtVertices, pauseMs, false);
      const motionT =
        cueMoveDurationMs > 0 ? Math.max(0, Math.min(1, tauMs / cueMoveDurationMs)) : 1;
      const pathProgress = cuePathDecelerationProgress(motionT);

      const cueNorm = cueDone ? lastCueVertex : sampleCueMotion(cuePlan, pathProgress, rect).normalized;

      const overrides: BallNormOverrides = { [cueKey]: cueNorm };

      let tObj = 0;
      if (hasReflectionPath && objPlan && playbackData.reflectionObjectBall) {
        const pastContact = pathProgress + 1e-8 >= pContact || cueDone;
        if (pastContact) {
          if (!objectStarted) {
            objectStarted = true;
            objectStartTime = now;
            setPlaybackPhase("object");
          }
          tObj = Math.min(1, (now - objectStartTime) / objectDurationMs);
          const objProgress = cuePathDecelerationProgress(tObj);
          const objPos = sampleObjectMotion(objPlan, objProgress, rect);
          overrides[movingKey] = objPos.normalized;
        }
      }

      setBallNormOverrides(overrides);

      if (collisionWarningsEnabled) {
        let ignoreTouchingBallKeys: ("red" | "yellow" | "white")[] | undefined;
        if (hasReflectionPath && switchIgnoreKey) {
          ignoreTouchingBallKeys = [switchIgnoreKey];
        }
        if (!cueDone) {
          if (
            cuePhaseCollisionWithOthers(cueNorm, placement, rect, {
              ignoreTouchingBallKeys,
              initialTouchingPairs,
            })
          ) {
            setCollisionMessage(COLLISION_POPUP_MESSAGE);
            setPlaybackPhase("idle");
            rafRef.current = 0;
            return;
          }
        }
        if (objectStarted && objPlan) {
          const skipEarly = tObj < 0.12;
          const objNorm = overrides[movingKey]!;
          if (
            objectPhaseCollisionWithOthers(
              objNorm,
              movingKey,
              placement,
              cueNorm,
              rect,
              skipEarly,
              tObj,
              { initialTouchingPairs }
            )
          ) {
            setCollisionMessage(COLLISION_POPUP_MESSAGE);
            setPlaybackPhase("idle");
            rafRef.current = 0;
            return;
          }
        }
      }

      const objectDone =
        !hasReflectionPath ||
        !objPlan ||
        !playbackData.reflectionObjectBall ||
        !objectStarted ||
        tObj >= 1;
      if (!cueDone || !objectDone) {
        rafRef.current = requestAnimationFrame(stepPlayback);
      } else {
        setPlaybackPhase("idle");
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(stepPlayback);
  }, [
    options.ballPlacement,
    playbackData,
    cuePlan,
    options.pathPoints,
    rect,
    cancelRaf,
    visualizationPlaybackTiming,
    collisionWarningsEnabled,
  ]);

  const canPlayback = Boolean(options.ballPlacement && playbackData && cuePlan);

  const isPlaybackActive = playbackPhase !== "idle" && collisionMessage === null;
  const stoppedOnCollision = collisionMessage !== null && ballNormOverrides !== null;

  return {
    ballNormOverrides,
    playbackPhase,
    collisionMessage,
    dismissCollisionMessage,
    startPlayback,
    resetPlayback,
    canPlayback,
    isPlaybackActive,
    stoppedOnCollision,
  };
}
