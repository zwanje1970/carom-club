"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  getPlayfieldRect,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import { ballSpeedToLegacySpeed, ballSpeedToLegacySpeedLevel } from "@/lib/ball-speed-constants";
import { ballSpeedToRailCount } from "@/lib/ball-speed-constants";
import type { BallSpeed } from "@/lib/ball-speed-constants";
import type { NormPoint } from "@/lib/path-motion-geometry";
import {
  collectInitialTouchingBallPairs,
  cuePhaseCollisionWithOthers,
  objectPhaseCollisionWithOthers,
} from "@/lib/path-playback-collision";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguCurveNode,
  type NanguPathPoint,
  type NanguSolutionData,
} from "@/lib/nangu-types";
import { computePolylinePlaybackDurationMs } from "@/lib/path-animation-timing";
import {
  buildSegmentTimesMsProportionalToLength,
  distancePxAfterTimeMsAlongVariableEdgeTimes,
  timeMsForDistanceAlongVariableEdgeTimes,
  troublePlaybackSpeedFactorFromRailCount,
} from "@/lib/trouble-playback-rail-timing";
import {
  clamp01,
  easeOutCue,
  easeOutObject,
} from "@/lib/solver-engine/core/easing";
import { polylineSegmentLengthsPx } from "@/lib/path-motion-geometry";
import {
  buildCuePathMotionPlan,
  buildObjectPathMotionPlan,
  buildObjectPathMotionPlanWithStartVertex,
  computeCueProgress01ForFirstObjectHitAlongFullPath,
  sampleCueMotion,
  sampleObjectMotion,
} from "@/lib/solution-path-motion";
import {
  cueFirstObjectHitFromBallPlacement,
  resolveEffectiveFirstObjectCollisionFromCuePath,
} from "@/lib/solution-path-geometry";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import { getCuePlayableDistanceFromBallSpeed } from "@/lib/trouble-playback-distance";
import { getThicknessLossRatio } from "@/lib/trouble-thickness-split";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { buildTroublePlaybackSolutionData } from "@/lib/solver-engine/policies/trouble-playback-solution-data";
import { isTroublePlaybackVerboseLogEnabled } from "@/lib/trouble-playback-verbose-log";

export const COLLISION_POPUP_MESSAGE = "異⑸룎??諛쒖깮?섏??듬땲??" as const;
const PLAYBACK_RESTORE_DELAY_MS = 3000;

/**
 * 개발 전용: 비례 세그먼트 시간이 `distancePxAfterTimeMsAlongVariableEdgeTimes`까지 그대로 쓰이는지(중간 균등화 없음)와
 * τ-공간 속도 L/T가 세그먼트마다 동일한지 로그로 증명한다.
 * 벽시계 속도는 이후 `easeOutCue` / `easeOutObject` 때문에 τ와 다르게 변함 — 별도 안내.
 */
function logSegmentPlaybackTimingAudit(
  phase: "cue" | "object",
  segmentLensPx: readonly number[],
  segmentTimesMs: readonly number[],
  tTotalMs: number
): void {
  if (process.env.NODE_ENV === "production" || !isTroublePlaybackVerboseLogEnabled()) return;
  const n = segmentLensPx.length;
  if (n === 0 || segmentTimesMs.length !== n) {
    console.debug(`[trouble-playback:segment-audit:${phase}]`, {
      skipped: true,
      segmentCount: n,
      timesLength: segmentTimesMs.length,
    });
    return;
  }

  const sumL = segmentLensPx.reduce((a, b) => a + b, 0);
  const sumTAlloc = segmentTimesMs.reduce((a, b) => a + b, 0);
  /** 비례 배분이면 모든 세그먼트에서 L_i/T_i = sumL/tTotalMs (τ-공간 등속) */
  const expectedTauSpeed = sumL > 1e-9 && tTotalMs > 1e-9 ? sumL / tTotalMs : 0;

  let prevTauSpeed: number | null = null;
  const segments: Array<{
    segmentIndex: number;
    segmentLength: number;
    allocatedSegmentDuration: number;
    segmentSpeed: number;
    deltaFromPreviousSegmentSpeed: number | null;
  }> = [];

  for (let i = 0; i < n; i++) {
    const len = segmentLensPx[i]!;
    const dur = segmentTimesMs[i]!;
    const speed = dur > 1e-12 ? len / dur : 0;
    segments.push({
      segmentIndex: i,
      segmentLength: len,
      allocatedSegmentDuration: dur,
      segmentSpeed: speed,
      deltaFromPreviousSegmentSpeed: prevTauSpeed != null ? speed - prevTauSpeed : null,
    });
    prevTauSpeed = speed;
  }

  const distAtFullTau = distancePxAfterTimeMsAlongVariableEdgeTimes(
    tTotalMs,
    segmentLensPx,
    segmentTimesMs
  );
  const distMismatch = Math.abs(distAtFullTau - sumL);

  let cumulativeOk = true;
  let accT = 0;
  for (let i = 0; i < n; i++) {
    accT += segmentTimesMs[i]!;
    const accL = segmentLensPx.slice(0, i + 1).reduce((a, b) => a + b, 0);
    const d = distancePxAfterTimeMsAlongVariableEdgeTimes(accT, segmentLensPx, segmentTimesMs);
    if (Math.abs(d - accL) > 0.5) cumulativeOk = false;
  }

  console.debug(`[trouble-playback:segment-audit:${phase}]`, {
    allocationSource:
      "lib/solver-engine/core/equal-edge-timing.ts → buildSegmentTimesMsProportionalToLength(totalMs, segmentLensPx)",
    appliedPositionSource:
      "distancePxAfterTimeMsAlongVariableEdgeTimes(τ, segmentLensPx, segmentTimesMs) — same segmentTimesMs[]; no equal-edge / per-segment re-normalize between these steps",
    tTotalMs,
    sumSegmentLengthsPx: sumL,
    sumAllocatedSegmentTimesMs: sumTAlloc,
    sumAllocatedMatchesTTotal: Math.abs(sumTAlloc - tTotalMs) < 0.01,
    expectedUniformTauSpeed_pxPerMs: expectedTauSpeed,
    tauDistanceAtFullT_vs_sumLen: { distAtFullTau, sumL, mismatchPx: distMismatch },
    cumulativeTauDistanceChecksOk: cumulativeOk && distMismatch < 0.5,
    wallClockNote:
      "stepPlayback: τCue = easeOutCue(wall/tCue)*tCue, τObj = easeOutObj(...)*tObj. 이징 A/B: .env에 NEXT_PUBLIC_DEBUG_DISABLE_PATH_PLAYBACK_EASING=true → τ=wall 비율 선형. τ 행 L/T는 segments[]로 확인.",
    segments,
  });

  if (!cumulativeOk || distMismatch >= 0.5) {
    console.warn(`[trouble-playback:segment-audit:${phase}] τ-distance consistency failed`, {
      cumulativeOk,
      distMismatch,
    });
  }
}

export type BallNormOverrides = Partial<Record<"red" | "yellow" | "white", NormPoint>>;

/** ?ъ깮 1???⑥쐞 ??대컢(臾멸뎄쨌object ?쒖옉 遺꾨━ ?뺤씤??. rAF留덈떎 媛깆떊?섏? ?딄퀬 ?댁젙?쒖뿉?쒕쭔 setState */
export type TroublePlaybackTimingDebug = {
  pHitFirst01: number;
  pWarnRecontactAfter01: number;
  hitProgressSource: string;
  movingKey: "red" | "yellow" | "white";
  cueWallDurationMs: number;
  /** 泥レ쑝濡?pathProgress ??pHitFirst01 ?????쒓컖(performance.now 湲곗?, ?ъ깮 start ?鍮? */
  cueHitRelMs: number | null;
  objectStartRelMs: number | null;
  cueCompleteRelMs: number | null;
  warningTriggeredRelMs: number | null;
  playbackPhaseAtEnd: "cue" | "object" | "idle";
};

export function useTroublePathPlayback(options: {
  ballPlacement: NanguBallPlacement | null;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  ballSpeed: BallSpeed;
  isBankShot: boolean;
  thicknessOffsetX: number;
  ignorePhysics?: boolean;
  width?: number;
  height?: number;
  /** ?ъ깮 ?꾩슜 怨≪꽑 ?쒖뼱?????먯젙쨌寃쎄퀬??吏곸꽑 pathPoints ?좎? */
  cuePathCurveControls?: PathSegmentCurveControl[];
  /** ?섍뎄 ?ъ깮 ??而⑦듃濡ㅻ낫???곗꽑 */
  cuePathCurveNodes?: NanguCurveNode[];
  objectPathCurveControls?: PathSegmentCurveControl[];
  /** 1紐??ъ깮 ??而⑦듃濡ㅻ낫???곗꽑 */
  objectPathCurveNodes?: NanguCurveNode[];
  /**
   * false硫??ъ깮 以?異⑸룎 ?앹뾽 鍮꾪솢?깊솕.
   * ??紐⑹쟻援?寃쎈줈??洹몃━湲겹띾? 耳쒓퀬 1紐??ㅽ뙚??1媛??댁긽???뚮쭔 true濡??먮뒗 寃껋쓣 沅뚯옣.
   */
  collisionWarningsEnabled?: boolean;
  /** 재생 배속(0.5=절반 속도, 1=기본 속도) */
  playbackRate?: number;
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
  /** 留덉?留?`startPlayback` ?댄썑 ?댁젙???쒓컖쨌?꾧퀎 吏꾪뻾瑜?E2E/DOM ?붾쾭洹? */
  playbackTimingDebug: TroublePlaybackTimingDebug | null;
  playbackReflectionMeta: {
    reflectionPathReady: boolean;
    reflectionObjectBall: "red" | "yellow" | "white" | null;
    struckKeySource: "resolve" | "geometry" | "none";
    objectPathPointsLen: number;
    movingBallKeyResolved: "red" | "yellow" | "white" | null;
  };
  /** ?ъ깮???섍뎄 ?대━?쇱씤 ?붾쾭洹??쒖떆 ?쒗븳) */
  cuePlaybackPathDebug: {
    polylineVertexCount: number;
    cueCurveNodeCount: number;
    cueCurveControlCount: number;
    hasCueCurvePlayback: boolean;
  } | null;
  objectPlaybackPathDebug: {
    polylineVertexCount: number;
    objectCurveNodeCount: number;
    objectCurveControlCount: number;
    hasObjectCurvePlayback: boolean;
  } | null;
  /** ?섍뎄 ?쒖뿰: UI 蹂쇱뒪?쇰뱶 ?쒕룄 vs ?대━?쇱씤 湲몄씠 */
  cuePlaybackDistanceDebug: {
    playableDistancePx: number;
    polylineLengthPx: number;
    effectiveTravelLengthPx: number;
    stopsEarly: boolean;
    thicknessLossRatio: number | null;
    cueDistanceBeforeHitPx: number | undefined;
    cueDistanceAfterHitCapPx: number | undefined;
    thicknessSplitApplied: boolean;
    curveDampingMeanCoefficient: number | null;
    curveSegmentCount: number | null;
    effectivePolylineLengthPx: number | null;
    curveDampingApplied: boolean;
  } | null;
  /** 1紐??쒖뿰: V횞L ?쒕룄 vs ?대━?쇱씤 湲몄씠 */
  objectPlaybackDistanceDebug: {
    playableDistancePx: number;
    objectDistanceFromHitPx: number;
    polylineLengthPx: number;
    effectiveTravelLengthPx: number;
    stopsEarly: boolean;
    curveDampingMeanCoefficient: number | null;
    curveSegmentCount: number | null;
    effectivePolylineLengthPx: number | null;
    curveDampingApplied: boolean;
  } | null;
} {
  const width = options.width ?? DEFAULT_TABLE_WIDTH;
  const height = options.height ?? DEFAULT_TABLE_HEIGHT;
  const rect = useMemo(() => getPlayfieldRect(width, height), [width, height]);
  /** 1紐??쒖뿰 ?대━?쇱씤 = SVG ?ㅽ뙚 以묒떖(`spotCenterNormForDraw`)怨??숈씪 ??留덉?留??ㅽ뙚 ?뺢??대뜲 ?꾩갑 */
  const objectPathVizOptions = useMemo(
    () =>
      options.ballPlacement
        ? {
            visualizationPlayback: true as const,
            objectBallNormsForSpotDraw: getNonCueBallNorms(options.ballPlacement).map((b) => ({
              x: b.x,
              y: b.y,
            })),
          }
        : { visualizationPlayback: true as const },
    [options.ballPlacement]
  );
  const collisionWarningsEnabled = options.collisionWarningsEnabled ?? false;

  const playbackData = useMemo(() => {
    if (!options.ballPlacement) return null;
    return buildTroublePlaybackSolutionData({
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

  /** ?붾쾭洹맞텲2E: ?ъ깮 ?곗씠?곌? ?뚮뜑(1紐㈑룻뙆? ??? 遺숈뿀?붿? DOM?먯꽌 ?뺤씤 */
  const playbackReflectionMeta = useMemo(() => {
    if (!options.ballPlacement || options.pathPoints.length < 1) {
      return {
        reflectionPathReady: false,
        reflectionObjectBall: null as "red" | "yellow" | "white" | null,
        struckKeySource: "none" as const,
        objectPathPointsLen: options.objectPathPoints.length,
        movingBallKeyResolved: null as "red" | "yellow" | "white" | null,
      };
    }
    const cuePosMeta =
      options.ballPlacement.cueBall === "yellow"
        ? options.ballPlacement.yellowBall
        : options.ballPlacement.whiteBall;
    const resolved = resolveTroubleFirstObjectBallKey({
      placement: options.ballPlacement,
      cuePos: cuePosMeta,
      pathPoints: options.pathPoints,
      objectPathPoints: options.objectPathPoints,
      rect,
    });
    const hit = cueFirstObjectHitFromBallPlacement(
      cuePosMeta,
      options.pathPoints[0]!,
      options.ballPlacement,
      rect
    );
    const movingBallKeyResolved = resolved ?? hit?.objectKey ?? null;
    return {
      reflectionPathReady: Boolean(
        playbackData?.reflectionPath?.points && playbackData.reflectionPath.points.length >= 2
      ),
      reflectionObjectBall: (playbackData?.reflectionObjectBall ?? null) as
        | "red"
        | "yellow"
        | "white"
        | null,
      struckKeySource: resolved ? ("resolve" as const) : hit?.objectKey ? ("geometry" as const) : ("none" as const),
      objectPathPointsLen: options.objectPathPoints.length,
      movingBallKeyResolved,
    };
  }, [
    options.ballPlacement,
    options.pathPoints,
    options.objectPathPoints,
    rect,
    playbackData,
  ]);

  const cuePlan = useMemo(() => {
    if (!options.ballPlacement || !playbackData) return null;
    return buildCuePathMotionPlan(options.ballPlacement, playbackData, rect, {
      ...objectPathVizOptions,
      visualizationPlayback: true,
      troublePlaybackModel: true,
      ignorePhysics: Boolean(options.ignorePhysics),
      cuePathCurveControls: options.cuePathCurveControls,
      cuePathCurveNodes: options.cuePathCurveNodes,
      objectPathCurveControls: options.objectPathCurveControls,
    });
  }, [
    options.ballPlacement,
    playbackData,
    rect,
    objectPathVizOptions,
    options.cuePathCurveControls,
    options.cuePathCurveNodes,
    options.objectPathCurveControls,
    options.ignorePhysics,
  ]);

  const [ballNormOverrides, setBallNormOverrides] = useState<BallNormOverrides | null>(null);
  const [playbackPhase, setPlaybackPhase] = useState<"idle" | "cue" | "object">("idle");
  const [collisionMessage, setCollisionMessage] = useState<string | null>(null);
  const [playbackTimingDebug, setPlaybackTimingDebug] = useState<TroublePlaybackTimingDebug | null>(null);
  const rafRef = useRef<number>(0);
  const restoreTimerRef = useRef<number | null>(null);

  const cancelRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const clearRestoreTimer = useCallback(() => {
    if (restoreTimerRef.current != null) {
      window.clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }
  }, []);

  const resetPlayback = useCallback(() => {
    clearRestoreTimer();
    cancelRaf();
    setBallNormOverrides(null);
    setPlaybackPhase("idle");
    setPlaybackTimingDebug(null);
  }, [cancelRaf, clearRestoreTimer]);

  const dismissCollisionMessage = useCallback(() => {
    setCollisionMessage(null);
  }, []);

  useEffect(() => {
    resetPlayback();
    setCollisionMessage(null);
    setPlaybackTimingDebug(null);
  }, [
    options.pathPoints,
    options.objectPathPoints,
    options.ballPlacement,
    options.ballSpeed,
    options.isBankShot,
    options.thicknessOffsetX,
    options.cuePathCurveControls,
    options.cuePathCurveNodes,
    options.objectPathCurveControls,
    options.objectPathCurveNodes,
    options.ignorePhysics,
    resetPlayback,
  ]);

  useEffect(
    () => () => {
      cancelRaf();
      clearRestoreTimer();
    },
    [cancelRaf, clearRestoreTimer]
  );

  const startPlayback = useCallback(() => {
    const placement = options.ballPlacement;
    if (!placement || !playbackData || !cuePlan) return;
    clearRestoreTimer();
    cancelRaf();
    setCollisionMessage(null);
    /** ?ъ깮? ??긽 諛곗튂 湲곗? ?쒖옉?먯뿉???쒖옉 */
    setBallNormOverrides(null);
    setPlaybackPhase("cue");
    const hasReflectionPath =
      Boolean(playbackData.reflectionPath?.points) &&
      (playbackData.reflectionPath!.points!.length >= 2);
    const segmentLens = polylineSegmentLengthsPx(cuePlan.polylineNormalized, rect);
    const redPathLengthPx = cuePlan.pathLengthPx;
    const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
    const start = performance.now();
    const initialTouchingPairs = collectInitialTouchingBallPairs(placement, rect);

    const lastCueVertex =
      cuePlan.polylineNormalized[cuePlan.polylineNormalized.length - 1]!;

    const cuePosStart =
      placement.cueBall === "yellow" ? placement.yellowBall : placement.whiteBall;
    const firstHitInfo = cueFirstObjectHitFromBallPlacement(
      cuePosStart,
      options.pathPoints[0]!,
      placement,
      rect
    );
    const effectiveContactPlayback = resolveEffectiveFirstObjectCollisionFromCuePath(
      placement,
      cuePosStart,
      options.pathPoints,
      rect
    );

    const dTotal = cuePlan.pathLengthPx;
    /**
     * 1紐?object ?섏씠利??쒖옉: **泥?* 1紐?怨??ㅽ뙚源뚯???嫄곕━ 鍮꾩쑉(?꾩껜 鍮④컙 湲몄씠 ?鍮?.
     * 留덉?留?ball ?ㅽ뙚 鍮꾩쑉???곕㈃(援?`pContact`) 1紐⑹씠 ?섍뎄 ?쒖뿰 ?앷퉴吏 諛由???寃쎄퀬 ?꾧퀎媛믨낵 遺꾨━.
     */
    const struckForHitProgress = playbackData.reflectionObjectBall ?? null;
    const hitAlong =
      hasReflectionPath && struckForHitProgress
        ? computeCueProgress01ForFirstObjectHitAlongFullPath(
            cuePlan,
            options.pathPoints,
            placement,
            rect,
            struckForHitProgress
          )
        : { pHit01: 1, hitPathPointIndex: null as number | null, source: "end" as const };
    const pHitFirst = hitAlong.pHit01;
    const segAtHit =
      hitAlong.hitPathPointIndex != null ? segmentLens[hitAlong.hitPathPointIndex] ?? 0 : 0;
    const recontactBump01 = Math.max(
      1e-4,
      Math.min(0.06, dTotal > 0 ? (segAtHit / dTotal) * 0.4 : 1e-4)
    );
    /** 泥??묒큺 援ш컙???앸궃 ?ㅼ뿉留??섍뎄??紐?留욌떯?뚯쓣 ?ъ땐?뚮줈 ?먯젙(泥??우쓬 吏곹썑 ?꾨젅???ㅽ깘 諛⑹?) */
    const pWarnRecontactAfter = Math.min(1, pHitFirst + recontactBump01);

    /** 1목 경로 시작: 광선상 충돌 접점(수구 폴리라인이 닿을 때만 유효) — 공 중심 아님 */
    let objectPathStartNorm: NormPoint;
    if (
      playbackData.reflectionPath?.points &&
      playbackData.reflectionPath.points.length >= 2 &&
      playbackData.reflectionObjectBall &&
      effectiveContactPlayback
    ) {
      objectPathStartNorm = {
        x: effectiveContactPlayback.collision.x,
        y: effectiveContactPlayback.collision.y,
      };
    } else if (playbackData.reflectionPath?.points?.[0]) {
      const p0 = playbackData.reflectionPath.points[0];
      objectPathStartNorm = { x: p0.x, y: p0.y };
    } else {
      objectPathStartNorm = lastCueVertex;
    }

    const objPlan =
      hasReflectionPath && playbackData.reflectionObjectBall
        ? buildObjectPathMotionPlanWithStartVertex(
            playbackData,
            objectPathStartNorm,
            rect,
            {
              ...objectPathVizOptions,
              troublePlaybackModel: true,
              ignorePhysics: Boolean(options.ignorePhysics),
              objectPathCurveControls: options.objectPathCurveControls,
              objectPathCurveNodes: options.objectPathCurveNodes,
            }
          )
        : null;

    const ignorePhy = Boolean(options.ignorePhysics);
    /**
     * 실험: `NEXT_PUBLIC_DEBUG_DISABLE_PATH_PLAYBACK_EASING=true` 이면 wallMs 비율을 τ에 **선형**으로 넣고
     * `easeOutCue` / `easeOutObject`를 끈다. 세그먼트 길이 비례 시간은 그대로(`cueSegmentTimesMs` 등).
     * 쿠션 직후 느려짐이 사라지면 이징이 화면 속도 출렁임의 원인으로 확정 가능.
     */
    const playbackEasingDisabled =
      process.env.NEXT_PUBLIC_DEBUG_DISABLE_PATH_PLAYBACK_EASING === "true";
    const playbackRate = Number.isFinite(options.playbackRate) ? Math.max(0.1, options.playbackRate as number) : 1;
    const railCount = ballSpeedToRailCount(options.ballSpeed);
    const speedFactor = ignorePhy ? 1 : troublePlaybackSpeedFactorFromRailCount(railCount);
    const dHit = pHitFirst * dTotal;
    const objSegLens = objPlan ? polylineSegmentLengthsPx(objPlan.polylineNormalized, rect) : [];

    let tCueTotalMs: number;
    let tObjTotalMs: number;

    const cueDurationSourcePx = Math.max(1, cuePlan.effectiveTravelPx);
    const baseCueDurationMs = Math.max(1, Math.round(computePolylinePlaybackDurationMs(cueDurationSourcePx, rect)));
    tCueTotalMs = Math.max(1, Math.round(baseCueDurationMs / speedFactor / playbackRate));
    /** 세그먼트마다 동일 시간이 아니라 **길이 비율**로 시간 분배 → 경로상 속도가 구간 길이에 덜 의존 */
    const cueSegmentTimesMs = buildSegmentTimesMsProportionalToLength(tCueTotalMs, segmentLens);
    const objectDurationSourcePx = hasReflectionPath && objPlan ? Math.max(1, objPlan.effectiveTravelPx) : 0;
    const baseObjectDurationMs =
      objectDurationSourcePx > 0 ? Math.max(1, Math.round(computePolylinePlaybackDurationMs(objectDurationSourcePx, rect))) : 0;
    tObjTotalMs =
      objectDurationSourcePx > 0
        ? Math.max(1, Math.round(baseObjectDurationMs / speedFactor / playbackRate))
        : 0;
    const objSegmentTimesMs =
      tObjTotalMs > 0 && objSegLens.length > 0
        ? buildSegmentTimesMsProportionalToLength(tObjTotalMs, objSegLens)
        : [];

    const tHitMs = timeMsForDistanceAlongVariableEdgeTimes(dHit, segmentLens, cueSegmentTimesMs);
    const totalWallMs = Math.max(tCueTotalMs, tHitMs + tObjTotalMs);
    const cueAlongMaxRaw = distancePxAfterTimeMsAlongVariableEdgeTimes(
      tCueTotalMs,
      segmentLens,
      cueSegmentTimesMs
    );
    const cueAlongMax = Math.max(1e-6, cueAlongMaxRaw);
    const objAlongMaxRaw =
      tObjTotalMs > 0 && objSegmentTimesMs.length > 0
        ? distancePxAfterTimeMsAlongVariableEdgeTimes(tObjTotalMs, objSegLens, objSegmentTimesMs)
        : 0;
    const objAlongMax = Math.max(1e-6, objAlongMaxRaw);

    logSegmentPlaybackTimingAudit("cue", segmentLens, cueSegmentTimesMs, tCueTotalMs);
    if (tObjTotalMs > 0 && objSegmentTimesMs.length > 0) {
      logSegmentPlaybackTimingAudit("object", objSegLens, objSegmentTimesMs, tObjTotalMs);
    }

    if (isTroublePlaybackVerboseLogEnabled()) {
      console.debug("[trouble-playback:rail-time-summary]", {
        railCount,
        speedFactor,
        playbackRate,
        totalWallMs,
        ignorePhysics: ignorePhy,
        playbackEasingDisabled,
      });
    }
    if (playbackEasingDisabled && isTroublePlaybackVerboseLogEnabled()) {
      console.info(
        "[trouble-playback] easing OFF for this run — compare cushion short-leg jank; set env to false to restore easeOutCue/object"
      );
    }

    const movingKey = (playbackData.reflectionObjectBall ?? "red") as "red" | "yellow" | "white";

    setPlaybackTimingDebug({
      pHitFirst01: pHitFirst,
      pWarnRecontactAfter01: pWarnRecontactAfter,
      hitProgressSource: hitAlong.source,
      movingKey,
      cueWallDurationMs: totalWallMs,
      cueHitRelMs: null,
      objectStartRelMs: null,
      cueCompleteRelMs: null,
      warningTriggeredRelMs: null,
      playbackPhaseAtEnd: "cue",
    });

    let objectStarted = false;
    let cueCompleteLogged = false;
    let lastCueLogBucket = -1;
    let lastObjLogBucket = -1;

    /**
     * 1紐?異⑸룎 寃쎄퀬 ?쒖쇅??"?ㅼ젣 ?ъ깮?먯꽌 1紐⑹쑝濡??吏곸씠??怨?怨?諛섎뱶???숈씪?댁빞 ?쒕떎.
     * ?곗꽑?쒖쐞:
     * 1) playbackData.reflectionObjectBall (?ъ깮 紐⑤뜽???⑥씪 ?뚯뒪)
     * 2) ?ㅽ뙚 湲곕컲 resolve
     * 3) 湲고븯?숈쟻 first hit (?ㅽ뙚???녿뒗 耳?댁뒪 蹂댁젙)
     */
    const switchIgnoreKey =
      playbackData.reflectionObjectBall ??
      resolveTroubleFirstObjectBallKey({
        placement,
        cuePos: cuePosStart,
        pathPoints: options.pathPoints,
        objectPathPoints: options.objectPathPoints,
        rect,
      }) ??
      firstHitInfo?.objectKey;

    /** 1紐⑹씠 ?꾨땶 鍮꾩닔援?2紐? ???섍뎄媛 ?ㅼ퀜 吏?섍???異⑸룎 ?앹뾽 ?놁쓬 */
    const nonCueBalls = getNonCueBallNorms(placement);
    const secondObjectKey: "red" | "yellow" | "white" | undefined =
      switchIgnoreKey && nonCueBalls.length === 2
        ? nonCueBalls.find((b) => b.key !== switchIgnoreKey)?.key
        : undefined;

    const stepPlayback = (now: number) => {
      const wallMs = now - start;
      const cueMotionDone = wallMs >= tCueTotalMs;
      const playbackDone = wallMs >= totalWallMs;

      const cueRawProgress = tCueTotalMs > 0 ? clamp01(wallMs / tCueTotalMs) : 1;
      const cueEasedProgress = playbackEasingDisabled
        ? cueRawProgress
        : easeOutCue(cueRawProgress);
      const cueWallForMotion = cueEasedProgress * tCueTotalMs;
      const dAlongRaw = distancePxAfterTimeMsAlongVariableEdgeTimes(
        cueWallForMotion,
        segmentLens,
        cueSegmentTimesMs
      );
      const cueCap = Math.min(cuePlan.moveDistancePx, cuePlan.pathLengthPx);
      const cueAlongRatio = clamp01(dAlongRaw / cueAlongMax);
      const dCue = cueCap * cueAlongRatio;
      const cueProgress01 = cueCap > 0 ? dCue / cueCap : 1;
      const cueNorm = sampleCueMotion(cuePlan, cueProgress01, rect).normalized;
      if (isTroublePlaybackVerboseLogEnabled()) {
        const cueBucket = Math.floor(cueRawProgress * 10);
        const nearTail = cueRawProgress >= 0.85;
        if (nearTail || cueBucket !== lastCueLogBucket) {
          lastCueLogBucket = cueBucket;
          console.debug("[trouble-playback:ease-cue]", {
            easingDisabled: playbackEasingDisabled,
            wallMs: Math.round(wallMs),
            rawProgress: Number(cueRawProgress.toFixed(4)),
            easedProgress: Number(cueEasedProgress.toFixed(4)),
            dAlongRaw: Number(dAlongRaw.toFixed(2)),
            cueCap: Number(cueCap.toFixed(2)),
            dCue: Number(dCue.toFixed(2)),
            remainingToCap: Number(Math.max(0, cueCap - dCue).toFixed(2)),
          });
        }
      }

      const traveledFrac = dTotal > 0 ? Math.min(1, dCue / dTotal) : 1;

      if (cueMotionDone && !cueCompleteLogged) {
        cueCompleteLogged = true;
        const rel = now - start;
        setPlaybackTimingDebug((d) => (d ? { ...d, cueCompleteRelMs: rel } : null));
      }

      const overrides: BallNormOverrides = { [cueKey]: cueNorm };

      let tObj01 = 0;
      if (hasReflectionPath && objPlan && playbackData.reflectionObjectBall) {
        if (wallMs + 1e-6 >= tHitMs) {
          if (!objectStarted) {
            objectStarted = true;
            setPlaybackPhase("object");
            const rel = wallMs;
            setPlaybackTimingDebug((d) =>
              d
                ? {
                    ...d,
                    cueHitRelMs: rel,
                    objectStartRelMs: rel,
                    playbackPhaseAtEnd: "object",
                  }
                : null
            );
          }
          const objElapsed = wallMs - tHitMs;
          const objRawProgress = tObjTotalMs > 0 ? clamp01(objElapsed / tObjTotalMs) : 1;
          const objEasedProgress = playbackEasingDisabled
            ? objRawProgress
            : easeOutObject(objRawProgress);
          const objMotionMs = objEasedProgress * tObjTotalMs;
          const dObjRaw = distancePxAfterTimeMsAlongVariableEdgeTimes(
            objMotionMs,
            objSegLens,
            objSegmentTimesMs
          );
          const objCap = Math.min(objPlan.moveDistancePx, objPlan.pathLengthPx);
          const objAlongRatio = clamp01(dObjRaw / objAlongMax);
          const dObj = objCap * objAlongRatio;
          tObj01 = objCap > 0 ? dObj / objCap : 1;
          const objPos = sampleObjectMotion(objPlan, tObj01, rect);
          overrides[movingKey] = objPos.normalized;
          if (isTroublePlaybackVerboseLogEnabled()) {
            const objBucket = Math.floor(objRawProgress * 10);
            const nearTail = objRawProgress >= 0.85;
            if (nearTail || objBucket !== lastObjLogBucket) {
              lastObjLogBucket = objBucket;
              console.debug("[trouble-playback:ease-object]", {
                easingDisabled: playbackEasingDisabled,
                wallMs: Math.round(wallMs),
                objElapsed: Math.round(objElapsed),
                rawProgress: Number(objRawProgress.toFixed(4)),
                easedProgress: Number(objEasedProgress.toFixed(4)),
                dObjRaw: Number(dObjRaw.toFixed(2)),
                objCap: Number(objCap.toFixed(2)),
                dObj: Number(dObj.toFixed(2)),
                remainingToCap: Number(Math.max(0, objCap - dObj).toFixed(2)),
              });
            }
          }
        }
      }

      setBallNormOverrides(overrides);

      if (collisionWarningsEnabled) {
        if (!cueMotionDone) {
          if (
            cuePhaseCollisionWithOthers(cueNorm, placement, rect, {
              neverWarnWhenTouchingBallKeys: secondObjectKey ? [secondObjectKey] : [],
              firstObjectBallKey: switchIgnoreKey ?? null,
              cuePathProgress01: traveledFrac,
              warnReContactAfterProgress: pWarnRecontactAfter,
              initialTouchingPairs,
            })
          ) {
            setCollisionMessage(COLLISION_POPUP_MESSAGE);
            setPlaybackPhase("idle");
            setPlaybackTimingDebug((d) =>
              d
                ? {
                    ...d,
                    warningTriggeredRelMs: now - start,
                    playbackPhaseAtEnd: "idle",
                  }
                : null
            );
            rafRef.current = 0;
            return;
          }
        }
        if (objectStarted && objPlan) {
          const skipEarly = tObj01 < 0.12;
          const objNorm = overrides[movingKey]!;
          if (
            objectPhaseCollisionWithOthers(
              objNorm,
              movingKey,
              placement,
              cueNorm,
              rect,
              skipEarly,
              tObj01,
              { initialTouchingPairs }
            )
          ) {
            setCollisionMessage(COLLISION_POPUP_MESSAGE);
            setPlaybackPhase("idle");
            setPlaybackTimingDebug((d) =>
              d
                ? {
                    ...d,
                    warningTriggeredRelMs: now - start,
                    playbackPhaseAtEnd: "idle",
                  }
                : null
            );
            rafRef.current = 0;
            return;
          }
        }
      }

      if (!playbackDone) {
        rafRef.current = requestAnimationFrame(stepPlayback);
      } else {
        setPlaybackPhase("idle");
        setPlaybackTimingDebug((d) => (d ? { ...d, playbackPhaseAtEnd: "idle" } : null));
        rafRef.current = 0;
        /** 재생 종료 후 3초간 최종 위치를 보여준 뒤 원래 배치로 복귀 */
        clearRestoreTimer();
        restoreTimerRef.current = window.setTimeout(() => {
          setBallNormOverrides(null);
          restoreTimerRef.current = null;
        }, PLAYBACK_RESTORE_DELAY_MS);
      }
    };
    rafRef.current = requestAnimationFrame(stepPlayback);
  }, [
    options.ballPlacement,
    playbackData,
    cuePlan,
    options.pathPoints,
    options.objectPathPoints,
    rect,
    cancelRaf,
    collisionWarningsEnabled,
    objectPathVizOptions,
    options.objectPathCurveControls,
    options.cuePathCurveControls,
    options.cuePathCurveNodes,
    options.objectPathCurveNodes,
    options.ignorePhysics,
    options.playbackRate,
    clearRestoreTimer,
  ]);

  const cuePlaybackPathDebug = useMemo(() => {
    if (!cuePlan) return null;
    const nc = options.cuePathCurveNodes?.length ?? 0;
    const cc = options.cuePathCurveControls?.length ?? 0;
    return {
      polylineVertexCount: cuePlan.polylineNormalized.length,
      cueCurveNodeCount: nc,
      cueCurveControlCount: cc,
      hasCueCurvePlayback: nc > 0 || cc > 0,
    };
  }, [cuePlan, options.cuePathCurveNodes, options.cuePathCurveControls]);

  const objectPlaybackPathDebug = useMemo(() => {
    if (!playbackData?.reflectionPath?.points || playbackData.reflectionPath.points.length < 2) {
      return null;
    }
    const objPlan = buildObjectPathMotionPlan(playbackData, rect, {
      ...objectPathVizOptions,
      visualizationPlayback: true,
      troublePlaybackModel: true,
      ignorePhysics: Boolean(options.ignorePhysics),
      objectPathCurveControls: options.objectPathCurveControls,
      objectPathCurveNodes: options.objectPathCurveNodes,
    });
    if (!objPlan) return null;
    const nc = options.objectPathCurveNodes?.length ?? 0;
    const cc = options.objectPathCurveControls?.length ?? 0;
    return {
      polylineVertexCount: objPlan.polylineNormalized.length,
      objectCurveNodeCount: nc,
      objectCurveControlCount: cc,
      hasObjectCurvePlayback: nc > 0 || cc > 0,
    };
  }, [
    playbackData,
    rect,
    objectPathVizOptions,
    options.objectPathCurveControls,
    options.objectPathCurveNodes,
    options.ignorePhysics,
  ]);

  const cuePlaybackDistanceDebug = useMemo(() => {
    if (!cuePlan) return null;
    const playable =
      cuePlan.playbackCuePlayableDistancePx ??
      getCuePlayableDistanceFromBallSpeed(rect, options.ballSpeed);
    const polyLen = cuePlan.pathLengthPx;
    const eff = cuePlan.effectiveTravelPx;
    return {
      playableDistancePx: playable,
      polylineLengthPx: polyLen,
      effectiveTravelLengthPx: eff,
      stopsEarly: eff + 1e-3 < polyLen,
      thicknessLossRatio: cuePlan.playbackThicknessLossRatioL ?? null,
      cueDistanceBeforeHitPx: cuePlan.playbackCueDistanceBeforeHitPx,
      cueDistanceAfterHitCapPx: cuePlan.playbackCueDistanceAfterHitCapPx,
      thicknessSplitApplied: cuePlan.playbackThicknessSplitApplied ?? false,
      curveDampingMeanCoefficient: cuePlan.playbackCurveDampingMeanCoefficient ?? null,
      curveSegmentCount: cuePlan.playbackCurveDampingCurveSegmentCount ?? null,
      effectivePolylineLengthPx: cuePlan.playbackEffectivePathCostPx ?? null,
      curveDampingApplied: cuePlan.playbackCurveDampingApplied ?? false,
    };
  }, [cuePlan, rect, options.ballSpeed]);

  const objectPlaybackDistanceDebug = useMemo(() => {
    if (!playbackData?.reflectionPath?.points || playbackData.reflectionPath.points.length < 2) {
      return null;
    }
    const objPlan = buildObjectPathMotionPlan(playbackData, rect, {
      ...objectPathVizOptions,
      visualizationPlayback: true,
      troublePlaybackModel: true,
      ignorePhysics: Boolean(options.ignorePhysics),
      objectPathCurveControls: options.objectPathCurveControls,
      objectPathCurveNodes: options.objectPathCurveNodes,
    });
    if (!objPlan) return null;
    const V =
      getCuePlayableDistanceFromBallSpeed(rect, options.ballSpeed) *
      getThicknessLossRatio(options.isBankShot, options.thicknessOffsetX);
    const playable =
      objPlan.playbackObjectPlayableDistancePx ?? V;
    return {
      playableDistancePx: playable,
      objectDistanceFromHitPx: playable,
      polylineLengthPx: objPlan.pathLengthPx,
      effectiveTravelLengthPx: objPlan.effectiveTravelPx,
      stopsEarly: objPlan.effectiveTravelPx + 1e-3 < objPlan.pathLengthPx,
      curveDampingMeanCoefficient: objPlan.playbackCurveDampingMeanCoefficient ?? null,
      curveSegmentCount: objPlan.playbackCurveDampingCurveSegmentCount ?? null,
      effectivePolylineLengthPx: objPlan.playbackEffectivePathCostPx ?? null,
      curveDampingApplied: objPlan.playbackCurveDampingApplied ?? false,
    };
  }, [
    playbackData,
    rect,
    objectPathVizOptions,
    options.objectPathCurveControls,
    options.objectPathCurveNodes,
    options.ballSpeed,
    options.isBankShot,
    options.thicknessOffsetX,
    options.ignorePhysics,
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
    playbackTimingDebug,
    playbackReflectionMeta,
    cuePlaybackPathDebug,
    objectPlaybackPathDebug,
    cuePlaybackDistanceDebug,
    objectPlaybackDistanceDebug,
  };
}

