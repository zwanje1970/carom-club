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
import { objectPhaseCollisionWithOthers } from "@/lib/path-playback-collision";
import type { NanguBallPlacement, NanguPathPoint, NanguSolutionData } from "@/lib/nangu-types";
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
  sampleCueMotion,
  sampleObjectMotion,
} from "@/lib/solution-path-motion";
import { cueFirstObjectHitFromBallPlacement } from "@/lib/solution-path-geometry";

export const COLLISION_POPUP_MESSAGE = "충돌이 발생하였습니다." as const;

export type BallNormOverrides = Partial<Record<"red" | "yellow" | "white", NormPoint>>;

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
  const collisionNorm =
    cueFirstObjectHitFromBallPlacement(cuePos, pathPoints[0], ballPlacement, rect)?.collision ?? null;

  let reflectionPath: NanguSolutionData["reflectionPath"];
  if (collisionNorm && objectPathPoints.length >= 1) {
    const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
    reflectionPath = {
      points: [{ x: collisionNorm.x, y: collisionNorm.y }, ...objPts],
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
   * 시연 감속 시간 기준 거리 = **수구→수구 마지막 스팟(화살표)까지 폴리라인** + **충돌→1목 마지막 스팟** (1목 있을 때).
   * 총 시간은 `computePolylinePlaybackDurationMs(합산 px)` 한 번으로 정하고, 수구/1목 구간은 길이 비율로 분배.
   */
  const visualizationPlaybackTiming = useMemo(() => {
    if (!cuePlan || !playbackData) return null;
    const cueLenPx = cuePlan.pathLengthPx;
    const rpPts = playbackData.reflectionPath?.points;
    const hasObjectPath = Boolean(rpPts && rpPts.length >= 2);
    const objPlan = hasObjectPath
      ? buildObjectPathMotionPlan(playbackData, rect, { visualizationPlayback: true })
      : null;
    const objLenPx = objPlan?.pathLengthPx ?? 0;
    const combinedLenPx = cueLenPx + objLenPx;
    const totalMs = computePolylinePlaybackDurationMs(combinedLenPx, rect);
    if (!hasObjectPath || objLenPx <= 0) {
      return { cueDurationMs: Math.max(1, Math.round(totalMs)), objectDurationMs: 0, combinedLenPx };
    }
    const cueDurationMs = Math.max(1, Math.round(totalMs * (cueLenPx / combinedLenPx)));
    const objectDurationMs = Math.max(1, Math.round(totalMs * (objLenPx / combinedLenPx)));
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
    if (!collisionMessage) return;
    const id = window.setTimeout(() => setCollisionMessage(null), 6000);
    return () => window.clearTimeout(id);
  }, [collisionMessage]);

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

  const runObjectPhase = useCallback(
    (
      placement: NanguBallPlacement,
      data: NanguSolutionData,
      cueEndNorm: NormPoint,
      durationMs: number
    ) => {
      const objPlan = buildObjectPathMotionPlan(data, rect, { visualizationPlayback: true });
      const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
      if (!objPlan || objPlan.pathLengthPx <= 0) {
        setPlaybackPhase("idle");
        setBallNormOverrides({ [cueKey]: cueEndNorm });
        return;
      }
      const duration = Math.max(1, Math.round(durationMs));
      const movingKey = data.reflectionObjectBall ?? "red";
      const start = performance.now();

      const stepObj = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const progress = cuePathDecelerationProgress(t);
        const pos = sampleObjectMotion(objPlan, progress, rect);
        setBallNormOverrides({
          [movingKey]: pos.normalized,
          [cueKey]: cueEndNorm,
        });
        const skipEarly = t < 0.12;
        if (
          objectPhaseCollisionWithOthers(
            pos.normalized,
            movingKey,
            placement,
            cueEndNorm,
            rect,
            skipEarly,
            t
          )
        ) {
          setCollisionMessage(COLLISION_POPUP_MESSAGE);
          setPlaybackPhase("idle");
          rafRef.current = 0;
          return;
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(stepObj);
        } else {
          setPlaybackPhase("idle");
          rafRef.current = 0;
        }
      };
      rafRef.current = requestAnimationFrame(stepObj);
    },
    [rect]
  );

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
    const numSpots = options.pathPoints.length;
    const pauseMs = PATH_ANIMATION_TIMING.cuePlaybackSpotPauseMs;
    const segmentLens = polylineSegmentLengthsPx(cuePlan.polylineNormalized, rect);
    const totalLen = segmentLens.reduce((a, b) => a + b, 0);
    /** 감속 진행률 p(τ/T)가 각 꼭짓점에서 누적 거리 비율과 일치하도록 τ(ms) 꼭짓점 — 멈춤 시간은 T에 포함하지 않음 */
    const tauAtVertices: number[] = [0];
    if (totalLen > 0 && numSpots > 0) {
      let cumLen = 0;
      for (let i = 0; i < numSpots; i++) {
        cumLen += segmentLens[i] ?? 0;
        const F = Math.min(1, Math.max(0, cumLen / totalLen));
        const tauFr = cuePlaybackTauFractionAtCumulativeDistance(F);
        tauAtVertices.push(cueMoveDurationMs * tauFr);
      }
    } else {
      tauAtVertices.push(cueMoveDurationMs);
    }
    const cueWallDurationMs = cuePlaybackWallDurationWithSpotPausesMs(
      cueMoveDurationMs,
      numSpots,
      pauseMs
    );
    const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
    const start = performance.now();

    const stepCue = (now: number) => {
      const wallMs = now - start;
      const cueWall = Math.min(cueWallDurationMs, wallMs);
      const tauMs = cuePlaybackMovementTauMsFromWallMs(cueWall, tauAtVertices, pauseMs);
      const motionT =
        cueMoveDurationMs > 0 ? Math.max(0, Math.min(1, tauMs / cueMoveDurationMs)) : 1;
      const progress = cuePathDecelerationProgress(motionT);
      const pos = sampleCueMotion(cuePlan, progress, rect);
      setBallNormOverrides({ [cueKey]: pos.normalized });

      if (wallMs < cueWallDurationMs) {
        rafRef.current = requestAnimationFrame(stepCue);
      } else {
        const cueEndNorm = pos.normalized;
        if (playbackData.reflectionPath?.points && playbackData.reflectionPath.points.length >= 2) {
          setPlaybackPhase("object");
          runObjectPhase(
            placement,
            playbackData,
            cueEndNorm,
            visualizationPlaybackTiming?.objectDurationMs ?? 1000
          );
        } else {
          setPlaybackPhase("idle");
          rafRef.current = 0;
        }
      }
    };
    rafRef.current = requestAnimationFrame(stepCue);
  }, [
    options.ballPlacement,
    playbackData,
    cuePlan,
    rect,
    cancelRaf,
    runObjectPhase,
    visualizationPlaybackTiming,
    options.pathPoints.length,
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
