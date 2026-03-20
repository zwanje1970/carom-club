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
  cuePhaseCollisionWithOthers,
  objectPhaseCollisionWithOthers,
} from "@/lib/path-playback-collision";
import type { NanguBallPlacement, NanguPathPoint, NanguSolutionData } from "@/lib/nangu-types";
import {
  buildCuePathMotionPlan,
  buildObjectPathMotionPlan,
  sampleCueMotion,
  sampleObjectMotion,
} from "@/lib/solution-path-motion";
import { cueObjectCollisionNormalized } from "@/lib/solution-path-geometry";

export const COLLISION_POPUP_MESSAGE = "충돌이 발생하였습니다." as const;

/** 1목 재생 초반: 수구-적색 맞춤 지점 근처 오탐 스킵 (진행률 기준) */
const OBJECT_PHASE_SKIP_CUE_RED_UNTIL_T = 0.12;

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
  const collisionNorm = cueObjectCollisionNormalized(
    cuePos,
    pathPoints[0],
    ballPlacement.redBall,
    rect
  );

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

export function useSolutionPathPlayback(options: {
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
    return buildCuePathMotionPlan(options.ballPlacement, playbackData, rect);
  }, [options.ballPlacement, playbackData, rect]);

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
    (placement: NanguBallPlacement, data: NanguSolutionData, cueEndNorm: NormPoint) => {
      const objPlan = buildObjectPathMotionPlan(data, rect);
      if (!objPlan || objPlan.pathLengthPx <= 0) {
        setPlaybackPhase("idle");
        setBallNormOverrides(null);
        return;
      }
      const duration = Math.max(1, objPlan.animationDurationMs ?? 1000);
      const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
      const start = performance.now();

      const stepObj = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const pos = sampleObjectMotion(objPlan, t, rect);
        setBallNormOverrides({
          red: pos.normalized,
          [cueKey]: cueEndNorm,
        });
        const skipEarly = t < OBJECT_PHASE_SKIP_CUE_RED_UNTIL_T;
        if (objectPhaseCollisionWithOthers(pos.normalized, placement, cueEndNorm, rect, skipEarly)) {
          setCollisionMessage(COLLISION_POPUP_MESSAGE);
          setPlaybackPhase("idle");
          rafRef.current = 0;
          return;
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(stepObj);
        } else {
          setPlaybackPhase("idle");
          setBallNormOverrides(null);
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
    setPlaybackPhase("cue");
    const duration = Math.max(1, cuePlan.animationDurationMs ?? 1000);
    const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
    const start = performance.now();

    const stepCue = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const pos = sampleCueMotion(cuePlan, t, rect);
      setBallNormOverrides({ [cueKey]: pos.normalized });

      if (cuePhaseCollisionWithOthers(pos.normalized, placement, rect)) {
        setCollisionMessage(COLLISION_POPUP_MESSAGE);
        setPlaybackPhase("idle");
        rafRef.current = 0;
        return;
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(stepCue);
      } else {
        const cueEndNorm = pos.normalized;
        if (playbackData.reflectionPath?.points && playbackData.reflectionPath.points.length >= 2) {
          setPlaybackPhase("object");
          runObjectPhase(placement, playbackData, cueEndNorm);
        } else {
          setPlaybackPhase("idle");
          setBallNormOverrides(null);
          rafRef.current = 0;
        }
      }
    };
    rafRef.current = requestAnimationFrame(stepCue);
  }, [options.ballPlacement, playbackData, cuePlan, rect, cancelRaf, runObjectPhase]);

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
