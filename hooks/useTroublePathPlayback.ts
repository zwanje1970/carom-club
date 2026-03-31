"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  distanceNormPointsInPlayfieldPx,
  getBallRadius,
  getPlayfieldLongSide,
  getPlayfieldRect,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import { ballSpeedToLegacySpeed, ballSpeedToLegacySpeedLevel } from "@/lib/ball-speed-constants";
import { ballSpeedToRailCount } from "@/lib/ball-speed-constants";
import type { BallSpeed } from "@/lib/ball-speed-constants";
import type { NormPoint } from "@/lib/path-motion-geometry";
import {
  collectInitialTouchingBallPairs,
  cuePathOverlapsObjectPathAtCueDistancePx,
  cuePhaseCollisionWithOthers,
  objectPhaseCollisionWithOthers,
} from "@/lib/path-playback-collision";
import {
  ballLabeledNormForKey,
  getNonCueBallNorms,
  getSecondObjectBallKeyExclusive,
  type NanguBallPlacement,
  type NanguCurveNode,
  type NanguPathPoint,
  type NanguSolutionData,
} from "@/lib/nangu-types";
import { computePolylinePlaybackDurationMs } from "@/lib/path-animation-timing";
import {
  buildSegmentTimesMsProportionalToLength,
  distancePxAfterTimeMsAlongVariableEdgeTimes,
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
  cuePathSpotCenterNormForPlaybackIndex,
  resolveTroubleCueHitProgress01,
  resolveTroubleSecondObjectHitProgress01,
  sampleCueMotion,
  sampleObjectMotion,
} from "@/lib/solution-path-motion";
import {
  cueFirstObjectHitFromBallPlacement,
  PLAYBACK_SPOT_CENTER_ALIGN_EPS_PX,
} from "@/lib/solution-path-geometry";
import { spotCenterNormForDraw } from "@/lib/path-spot-display";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import { getCuePlayableDistanceFromBallSpeed } from "@/lib/trouble-playback-distance";
import { getThicknessLossRatio } from "@/lib/trouble-thickness-split";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { buildTroublePlaybackSolutionData } from "@/lib/solver-engine/policies/trouble-playback-solution-data";
import {
  isPathPlaybackEasingAuditEnabled,
  isTroublePlaybackVerboseLogEnabled,
} from "@/lib/trouble-playback-verbose-log";

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

const BALL_NORM_KEYS = ["red", "yellow", "white"] as const;
/** norm 좌표 비교(매 rAF 새 객체 참조로 인한 불필요 리렌더 방지) */
const BALL_NORM_OVERRIDE_EPS = 1e-6;

function ballNormOverridesEqual(
  a: BallNormOverrides | null,
  b: BallNormOverrides | null
): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  for (const k of BALL_NORM_KEYS) {
    const pa = a[k];
    const pb = b[k];
    if (pa == null && pb == null) continue;
    if (pa == null || pb == null) return false;
    if (
      Math.abs(pa.x - pb.x) > BALL_NORM_OVERRIDE_EPS ||
      Math.abs(pa.y - pb.y) > BALL_NORM_OVERRIDE_EPS
    ) {
      return false;
    }
  }
  return true;
}

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
  playbackPhaseAtEnd: "idle" | "cue" | "object" | "object2";
};

/** rAF 루프 진행 시점 — 일시정지 후 동일 타임라인에서 이어 재생 */
type PlaybackTimelineSnapshot = {
  wallMs: number;
  objectStarted: boolean;
  objectStartWallMs: number | null;
  object2Started: boolean;
  object2StartWallMs: number | null;
  cueCompleteLogged: boolean;
};

export function useTroublePathPlayback(options: {
  ballPlacement: NanguBallPlacement | null;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  secondObjectPathPoints?: NanguPathPoint[];
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
  secondObjectPathCurveControls?: PathSegmentCurveControl[];
  secondObjectPathCurveNodes?: NanguCurveNode[];
  /**
   * false硫??ъ깮 以?異⑸룎 ?앹뾽 鍮꾪솢?깊솕.
   * ??紐⑹쟻援?寃쎈줈??洹몃━湲겹띾? 耳쒓퀬 1紐??ㅽ뙚??1媛??댁긽???뚮쭔 true濡??먮뒗 寃껋쓣 沅뚯옣.
   */
  collisionWarningsEnabled?: boolean;
  /** 재생 배속(0.5=절반 속도, 1=기본 속도) */
  playbackRate?: number;
}): {
  /** 재생 종료 후 복귀·충돌 스냅샷 등 커밋된 표시값(루프 중 매 프레임 갱신 아님) */
  ballNormOverrides: BallNormOverrides | null;
  /** 재생 루프가 매 프레임 갱신하는 위치 — 캔버스는 이 ref를 읽어 그림 */
  ballNormOverridesLiveRef: MutableRefObject<BallNormOverrides | null>;
  playbackPhase: "idle" | "cue" | "object" | "object2";
  collisionMessage: string | null;
  dismissCollisionMessage: () => void;
  startPlayback: () => void;
  /** 재생 루프만 멈추고 공·타임라인은 유지 — `startPlayback`으로 이어서 재생 */
  pausePlayback: () => void;
  resetPlayback: () => void;
  canPlayback: boolean;
  isPlaybackActive: boolean;
  /** `pausePlayback` 직후 — `startPlayback`으로 재개 */
  isPlaybackPaused: boolean;
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
  object2PlaybackPathDebug: {
    polylineVertexCount: number;
    objectCurveNodeCount: number;
    objectCurveControlCount: number;
    hasObjectCurvePlayback: boolean;
  } | null;
  object2PlaybackDistanceDebug: {
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

  const playbackData = useMemo(() => {
    if (!options.ballPlacement) return null;
    return buildTroublePlaybackSolutionData({
      ballPlacement: options.ballPlacement,
      pathPoints: options.pathPoints,
      objectPathPoints: options.objectPathPoints,
      secondObjectPathPoints: options.secondObjectPathPoints,
      ballSpeed: options.ballSpeed,
      isBankShot: options.isBankShot,
      thicknessOffsetX: options.thicknessOffsetX,
      rect,
    });
  }, [
    options.ballPlacement,
    options.pathPoints,
    options.objectPathPoints,
    options.secondObjectPathPoints,
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

  /** rAF 루프는 ref로만 읽고, 렌더용 state와 동기화 — startPlayback 의존성 고정 */
  const playbackBundleRef = useRef({
    options,
    playbackData,
    cuePlan,
    rect,
    objectPathVizOptions,
  });
  playbackBundleRef.current = {
    options,
    playbackData,
    cuePlan,
    rect,
    objectPathVizOptions,
  };

  const ballNormOverridesRef = useRef<BallNormOverrides | null>(null);
  const playbackPhaseRef = useRef<"idle" | "cue" | "object" | "object2">("idle");
  const isPlayingRef = useRef(false);

  /** 재생 루프 밖(UI·복구)에서만 갱신 — 루프 중 setState 금지 */
  const [committedBallNormOverrides, setCommittedBallNormOverrides] =
    useState<BallNormOverrides | null>(null);
  const [playbackPhase, setPlaybackPhase] = useState<"idle" | "cue" | "object" | "object2">("idle");
  const [collisionMessage, setCollisionMessage] = useState<string | null>(null);
  const [playbackTimingDebug, setPlaybackTimingDebug] = useState<TroublePlaybackTimingDebug | null>(null);
  const frameRef = useRef<number>(0);
  const restoreTimerRef = useRef<number | null>(null);
  const timelineScratchRef = useRef<PlaybackTimelineSnapshot>({
    wallMs: 0,
    objectStarted: false,
    objectStartWallMs: null,
    object2Started: false,
    object2StartWallMs: null,
    cueCompleteLogged: false,
  });
  const playbackResumeTimelineRef = useRef<PlaybackTimelineSnapshot | null>(null);
  const [playbackPaused, setPlaybackPaused] = useState(false);

  /** rAF 루프 전용: ref만 갱신, setState 없음 */
  const writeBallNormOverridesRefOnly = useCallback((next: BallNormOverrides | null) => {
    if (!ballNormOverridesEqual(ballNormOverridesRef.current, next)) {
      ballNormOverridesRef.current = next;
    }
  }, []);

  /** 재생 시작/종료/리셋·충돌 스냅샷 등 — ref와 표시 state 동시 반영 */
  const flushCommittedBallNormOverrides = useCallback((next: BallNormOverrides | null) => {
    ballNormOverridesRef.current = next;
    setCommittedBallNormOverrides(next);
  }, []);

  const commitPlaybackPhase = useCallback((next: "idle" | "cue" | "object" | "object2") => {
    if (playbackPhaseRef.current !== next) {
      playbackPhaseRef.current = next;
      setPlaybackPhase(next);
    }
  }, []);

  const cancelRaf = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    isPlayingRef.current = false;
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
    playbackResumeTimelineRef.current = null;
    setPlaybackPaused(false);
    flushCommittedBallNormOverrides(null);
    commitPlaybackPhase("idle");
    setPlaybackTimingDebug(null);
  }, [cancelRaf, clearRestoreTimer, flushCommittedBallNormOverrides, commitPlaybackPhase]);

  const pausePlayback = useCallback(() => {
    if (!isPlayingRef.current) return;
    cancelRaf();
    playbackResumeTimelineRef.current = { ...timelineScratchRef.current };
    const snap = ballNormOverridesRef.current;
    flushCommittedBallNormOverrides(snap ? { ...snap } : null);
    commitPlaybackPhase("idle");
    setPlaybackPaused(true);
  }, [cancelRaf, flushCommittedBallNormOverrides, commitPlaybackPhase]);

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
    options.secondObjectPathPoints,
    options.ballPlacement,
    options.ballSpeed,
    options.isBankShot,
    options.thicknessOffsetX,
    options.cuePathCurveControls,
    options.cuePathCurveNodes,
    options.objectPathCurveControls,
    options.objectPathCurveNodes,
    options.secondObjectPathCurveControls,
    options.secondObjectPathCurveNodes,
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
    const { options, playbackData, cuePlan, rect, objectPathVizOptions } = playbackBundleRef.current;
    const placement = options.ballPlacement;
    if (!placement || !playbackData || !cuePlan) return;
    clearRestoreTimer();
    const resumeSnap = playbackResumeTimelineRef.current;
    playbackResumeTimelineRef.current = null;
    if (resumeSnap) {
      setPlaybackPaused(false);
    } else {
      flushCommittedBallNormOverrides(null);
    }
    cancelRaf();
    setCollisionMessage(null);
    const initialPhase: "cue" | "object" | "object2" =
      resumeSnap?.object2Started ? "object2" : resumeSnap?.objectStarted ? "object" : "cue";
    commitPlaybackPhase(initialPhase);
    isPlayingRef.current = true;
    const collisionWarningsEnabled = options.collisionWarningsEnabled ?? false;
    const hasReflectionPath =
      Boolean(playbackData.reflectionPath?.points) &&
      (playbackData.reflectionPath!.points!.length >= 2);
    if (hasReflectionPath && playbackData.reflectionObjectBall == null) {
      isPlayingRef.current = false;
      commitPlaybackPhase("idle");
      frameRef.current = 0;
      return;
    }
    const segmentLens = polylineSegmentLengthsPx(cuePlan.polylineNormalized, rect);
    const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
    const start = performance.now() - (resumeSnap?.wallMs ?? 0);
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
    const dTotal = cuePlan.pathLengthPx;
    /**
     * 1紐?object ?섏씠利??쒖옉: **泥?* 1紐?怨??ㅽ뙚源뚯???嫄곕━ 鍮꾩쑉(?꾩껜 鍮④컙 湲몄씠 ?鍮?.
     * 留덉?留?ball ?ㅽ뙚 鍮꾩쑉???곕㈃(援?`pContact`) 1紐⑹씠 ?섍뎄 ?쒖뿰 ?앷퉴吏 諛由???寃쎄퀬 ?꾧퀎媛믨낵 遺꾨━.
     */
    const hitAlong = hasReflectionPath
      ? resolveTroubleCueHitProgress01(
          cuePlan,
          options.pathPoints,
          options.objectPathPoints,
          placement,
          cuePosStart,
          rect,
          playbackData.reflectionObjectBall
        )
      : { pHit01: 1, hitPathPointIndex: null as number | null, source: "end" as const };
    const pHitFirst = hitAlong.pHit01;
    const hit1CuePathIdx = hitAlong.hitPathPointIndex;
    const firstObjectCueHitSpotCenterNorm: NormPoint | null =
      hasReflectionPath && hit1CuePathIdx != null && options.pathPoints[hit1CuePathIdx]
        ? cuePathSpotCenterNormForPlaybackIndex(
            options.pathPoints,
            hit1CuePathIdx,
            placement,
            cuePosStart,
            rect
          )
        : null;
    const segAtHit =
      hitAlong.hitPathPointIndex != null ? segmentLens[hitAlong.hitPathPointIndex] ?? 0 : 0;
    const recontactBump01 = Math.max(
      1e-4,
      Math.min(0.06, dTotal > 0 ? (segAtHit / dTotal) * 0.4 : 1e-4)
    );
    /** 泥??묒큺 援ш컙???앸궃 ?ㅼ뿉留??섍뎄??紐?留욌떯?뚯쓣 ?ъ땐?뚮줈 ?먯젙(泥??우쓬 吏곹썑 ?꾨젅???ㅽ깘 諛⑹?) */
    const pWarnRecontactAfter = Math.min(1, pHitFirst + recontactBump01);

    const switchIgnoreKey =
      playbackData.reflectionObjectBall ??
      resolveTroubleFirstObjectBallKey({
        placement,
        cuePos: cuePosStart,
        pathPoints: options.pathPoints,
        objectPathPoints: options.objectPathPoints,
        rect,
      }) ??
      firstHitInfo?.objectKey ??
      null;

    const secondObjectKey: "red" | "yellow" | "white" | undefined =
      switchIgnoreKey != null
        ? getSecondObjectBallKeyExclusive(placement, switchIgnoreKey) ?? undefined
        : undefined;

    const struckBallKey = playbackData.reflectionObjectBall ?? null;
    const objectCenterForPathStart =
      struckBallKey == null ? null : ballLabeledNormForKey(placement, struckBallKey);

    /** 1목 경로 시작: 1목적구 중심(표시·에디터와 동일) */
    let objectPathStartNorm: NormPoint;
    if (
      playbackData.reflectionPath?.points &&
      playbackData.reflectionPath.points.length >= 2 &&
      playbackData.reflectionObjectBall &&
      objectCenterForPathStart
    ) {
      objectPathStartNorm = {
        x: objectCenterForPathStart.x,
        y: objectCenterForPathStart.y,
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
              playbackRemainingAfterPrePx: cuePlan.playbackRemainingAfterPrePx,
              objectPathCurveControls: options.objectPathCurveControls,
              objectPathCurveNodes: options.objectPathCurveNodes,
            }
          )
        : null;

    const ignorePhy = Boolean(options.ignorePhysics);

    const hasSecondReflectionPath =
      Boolean(playbackData.secondReflectionPath?.points) &&
      (playbackData.secondReflectionPath!.points!.length >= 2);

    const struckSecondForHitProgress = playbackData.secondReflectionObjectBall ?? null;
    const firstObjectKeyForSecondHit = switchIgnoreKey;

    /** 2목 페이즈: **수구** 폴리라인·수구 pathPoints만 사용(1목 경로·progress와 무관). */
    const hit2AlongCue =
      hasSecondReflectionPath && firstObjectKeyForSecondHit != null
        ? resolveTroubleSecondObjectHitProgress01(
            cuePlan,
            options.pathPoints,
            placement,
            rect,
            playbackData.secondReflectionObjectBall,
            firstObjectKeyForSecondHit
          )
        : { pHit01: 1, hitPathPointIndex: null as number | null, source: "end" as const };

    const pHitSecondCue01 = hit2AlongCue.pHit01;
    const dHit2Cue = pHitSecondCue01 * cuePlan.pathLengthPx;
    const reachTarget2CuePx = Math.min(dHit2Cue, cuePlan.moveDistancePx, cuePlan.pathLengthPx);

    const hit2CuePathIdx = hit2AlongCue.hitPathPointIndex;
    const secondObjectCueHitSpotCenterNorm: NormPoint | null =
      hasSecondReflectionPath && hit2CuePathIdx != null && options.pathPoints[hit2CuePathIdx]
        ? cuePathSpotCenterNormForPlaybackIndex(
            options.pathPoints,
            hit2CuePathIdx,
            placement,
            cuePosStart,
            rect
          )
        : null;

    const secondObjectCenterForPathStart =
      struckSecondForHitProgress == null
        ? null
        : ballLabeledNormForKey(placement, struckSecondForHitProgress);

    let secondObjectPathStartNorm: NormPoint | null = null;
    if (
      playbackData.secondReflectionPath?.points &&
      playbackData.secondReflectionPath.points.length >= 2 &&
      playbackData.secondReflectionObjectBall &&
      secondObjectCenterForPathStart
    ) {
      secondObjectPathStartNorm = {
        x: secondObjectCenterForPathStart.x,
        y: secondObjectCenterForPathStart.y,
      };
    } else if (playbackData.secondReflectionPath?.points?.[0]) {
      const p0 = playbackData.secondReflectionPath.points[0];
      secondObjectPathStartNorm = { x: p0.x, y: p0.y };
    }

    const obj2Data = {
      ...playbackData,
      reflectionPath: playbackData.secondReflectionPath,
      reflectionObjectBall: playbackData.secondReflectionObjectBall,
    };

    const obj2Plan =
      hasSecondReflectionPath && playbackData.secondReflectionObjectBall && secondObjectPathStartNorm
        ? buildObjectPathMotionPlanWithStartVertex(
            obj2Data as NanguSolutionData,
            secondObjectPathStartNorm,
            rect,
            {
              ...objectPathVizOptions,
              troublePlaybackModel: true,
              ignorePhysics: ignorePhy,
              /** `0`을 넘기면 `(0 ?? V0)*L === 0`이 되어 2목 이동 거리가 0이 됨 — 생략 시 V0·L로 시연 거리 부여 */
              objectPathCurveControls: options.secondObjectPathCurveControls,
              objectPathCurveNodes: options.secondObjectPathCurveNodes,
            }
          )
        : null;

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
    /** 1목 맞춤 거리(px) — `tCueTotalMs` 산출 전에도 사용(2목 시작 속도·τ 비율) */
    const reachTargetPx = Math.min(dHit, cuePlan.moveDistancePx, cuePlan.pathLengthPx);
    const objSegLens = objPlan ? polylineSegmentLengthsPx(objPlan.polylineNormalized, rect) : [];

    let tCueTotalMs: number;
    let tObjTotalMs: number;

    const cueDurationSourcePx = Math.max(1, cuePlan.effectiveTravelPx);
    const baseCueDurationMs = Math.max(1, Math.round(computePolylinePlaybackDurationMs(cueDurationSourcePx, rect)));
    tCueTotalMs = Math.max(1, Math.round(baseCueDurationMs / speedFactor / playbackRate));
    /** 세그먼트마다 동일 시간이 아니라 **길이 비율**로 시간 분배 → 경로상 속도가 구간 길이에 덜 의존 */
    const cueSegmentTimesMs = buildSegmentTimesMsProportionalToLength(tCueTotalMs, segmentLens);

    /** τ 끝에서의 폴리라인 raw 누적 — `dCue`·맞춤 raw 목표(`wallMsForCueAlongTarget`)에 앞당겨 사용 */
    const cueAlongMaxRaw = distancePxAfterTimeMsAlongVariableEdgeTimes(
      tCueTotalMs,
      segmentLens,
      cueSegmentTimesMs
    );
    const cueAlongMax = Math.max(1e-6, cueAlongMaxRaw);
    const cueCapStatic = Math.min(cuePlan.moveDistancePx, cuePlan.pathLengthPx);

    /** `easeOutCue` 도함수(0..1 raw) — easing.ts 식과 동일. 2목 시작 속도만 수구 2목 도달 τ에서 추출(1목 미사용). */
    const easeOutCueDerivative01 = (raw01: number) => {
      const x = clamp01(raw01);
      return 1.45 * Math.pow(1 - x, 0.45);
    };
    const cueAlongRawForWallMs = (wMs: number) => {
      const raw = tCueTotalMs > 0 ? clamp01(wMs / tCueTotalMs) : 1;
      const eased = playbackEasingDisabled ? raw : easeOutCue(raw);
      const motionMs = eased * tCueTotalMs;
      return distancePxAfterTimeMsAlongVariableEdgeTimes(motionMs, segmentLens, cueSegmentTimesMs);
    };
    const wallMsForCueAlongTarget = (targetPx: number) => {
      if (targetPx <= 0 || tCueTotalMs <= 0) return 0;
      const endD = cueAlongRawForWallMs(tCueTotalMs);
      if (targetPx >= endD - 1e-3) return tCueTotalMs;
      let lo = 0;
      let hi = tCueTotalMs;
      for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        if (cueAlongRawForWallMs(mid) >= targetPx) hi = mid;
        else lo = mid;
      }
      return hi;
    };

    const objectDurationSourcePx = hasReflectionPath && objPlan ? Math.max(1, objPlan.effectiveTravelPx) : 0;
    const baseObjectDurationMs =
      objectDurationSourcePx > 0 ? Math.max(1, Math.round(computePolylinePlaybackDurationMs(objectDurationSourcePx, rect))) : 0;
    /** 1적구 초기 속도 = 충돌 직전 수구 속도(Vc) × L 이 되도록, 거리(L배)와 동일 비율 L로 시간도 보정 */
    const objectStartSpeedScaleL = Math.max(0.05, Math.min(1, cuePlan.playbackThicknessLossRatioL ?? 1));
    tObjTotalMs =
      objectDurationSourcePx > 0
        ? Math.max(1, Math.round(baseObjectDurationMs / objectStartSpeedScaleL / speedFactor / playbackRate))
        : 0;
    const objSegmentTimesMs =
      tObjTotalMs > 0 && objSegLens.length > 0
        ? buildSegmentTimesMsProportionalToLength(tObjTotalMs, objSegLens)
        : [];

    /**
     * 2목: 두께 8/16 고정 × 수구가 2목 접촉 거리에 이를 때의 cue τ 속도(도함수 비, 시작 τ=0 대비).
     * 1목 hit·1목 속도·뱅크 두께 규칙은 사용하지 않는다.
     */
    const OBJECT2_FIXED_THICKNESS_RATIO = 8 / 16;
    let object2StartSpeedScaleL = Math.max(0.05, OBJECT2_FIXED_THICKNESS_RATIO);
    if (hasSecondReflectionPath && obj2Plan) {
      /** 표시 거리 `reachTarget2CuePx`에 해당하는 τ raw 누적 — `dAlongRaw` 축과 이진탐색 인자 일치 */
      const reach2AlongRawTarget =
        (reachTarget2CuePx * cueAlongMax) / Math.max(1e-9, cueCapStatic);
      const wallMsSecondHit = wallMsForCueAlongTarget(reach2AlongRawTarget);
      const rCueAt2 = tCueTotalMs > 0 ? wallMsSecondHit / tCueTotalMs : 1;
      const cueSpeedScaleAtSecondHit = playbackEasingDisabled
        ? 1
        : Math.min(1, easeOutCueDerivative01(rCueAt2) / Math.max(1e-4, easeOutCueDerivative01(0)));
      object2StartSpeedScaleL = Math.max(
        0.05,
        Math.min(1, OBJECT2_FIXED_THICKNESS_RATIO * cueSpeedScaleAtSecondHit)
      );
    }

    const obj2SegLens = obj2Plan ? polylineSegmentLengthsPx(obj2Plan.polylineNormalized, rect) : [];
    let tObj2TotalMs = 0;
    const object2DurationSourcePx = hasSecondReflectionPath && obj2Plan ? Math.max(1, obj2Plan.effectiveTravelPx) : 0;
    const baseObject2DurationMs =
      object2DurationSourcePx > 0 ? Math.max(1, Math.round(computePolylinePlaybackDurationMs(object2DurationSourcePx, rect))) : 0;
    tObj2TotalMs =
      object2DurationSourcePx > 0
        ? Math.max(1, Math.round(baseObject2DurationMs / object2StartSpeedScaleL / speedFactor / playbackRate))
        : 0;
    const obj2SegmentTimesMs =
      tObj2TotalMs > 0 && obj2SegLens.length > 0
        ? buildSegmentTimesMsProportionalToLength(tObj2TotalMs, obj2SegLens)
        : [];

    const objAlongMaxRaw =
      tObjTotalMs > 0 && objSegmentTimesMs.length > 0
        ? distancePxAfterTimeMsAlongVariableEdgeTimes(tObjTotalMs, objSegLens, objSegmentTimesMs)
        : 0;
    const objAlongMax = Math.max(1e-6, objAlongMaxRaw);
    const obj2AlongMaxRaw =
      tObj2TotalMs > 0 && obj2SegmentTimesMs.length > 0
        ? distancePxAfterTimeMsAlongVariableEdgeTimes(tObj2TotalMs, obj2SegLens, obj2SegmentTimesMs)
        : 0;
    const obj2AlongMax = Math.max(1e-6, obj2AlongMaxRaw);

    /**
     * 1목·2목 출발: 스팟 중심 정렬 + (`dAlongRaw` 또는 `dCue`)로 맞춤 거리 도달 — cap·곡선에서 한 축만 쓰면 영구 미출발·조기 출발이 난다.
     */

    logSegmentPlaybackTimingAudit("cue", segmentLens, cueSegmentTimesMs, tCueTotalMs);
    if (tObjTotalMs > 0 && objSegmentTimesMs.length > 0) {
      logSegmentPlaybackTimingAudit("object", objSegLens, objSegmentTimesMs, tObjTotalMs);
    }

    const estimatedWallDurationMs = tCueTotalMs + tObjTotalMs + tObj2TotalMs;
    if (isTroublePlaybackVerboseLogEnabled()) {
      console.debug("[trouble-playback:rail-time-summary]", {
        railCount,
        speedFactor,
        playbackRate,
        estimatedWallDurationMs,
        ignorePhysics: ignorePhy,
        playbackEasingDisabled,
      });
    }
    if (playbackEasingDisabled && isTroublePlaybackVerboseLogEnabled()) {
      console.info(
        "[trouble-playback] easing OFF for this run — compare cushion short-leg jank; set env to false to restore easeOutCue/object"
      );
    }

    const movingKey = hasReflectionPath
      ? (playbackData.reflectionObjectBall as "red" | "yellow" | "white")
      : ((switchIgnoreKey ?? firstHitInfo?.objectKey ?? cueKey) as "red" | "yellow" | "white");

    if (!resumeSnap) {
      setPlaybackTimingDebug({
        pHitFirst01: pHitFirst,
        pWarnRecontactAfter01: pWarnRecontactAfter,
        hitProgressSource: hitAlong.source,
        movingKey,
        cueWallDurationMs: estimatedWallDurationMs,
        cueHitRelMs: null,
        objectStartRelMs: null,
        cueCompleteRelMs: null,
        warningTriggeredRelMs: null,
        playbackPhaseAtEnd: "cue",
      });
    }

    let objectStarted = resumeSnap?.objectStarted ?? false;
    /** object phase 시작 벽시계(ms) — dCue가 reachTargetPx에 도달한 프레임(이징과 동기) */
    let objectStartWallMs = resumeSnap?.objectStartWallMs ?? null;
    let object2Started = resumeSnap?.object2Started ?? false;
    let object2StartWallMs = resumeSnap?.object2StartWallMs ?? null;
    let cueCompleteLogged = resumeSnap?.cueCompleteLogged ?? false;
    let lastCueLogBucket = -1;
    let lastObjLogBucket = -1;

    timelineScratchRef.current = {
      wallMs: resumeSnap?.wallMs ?? 0,
      objectStarted,
      objectStartWallMs,
      object2Started,
      object2StartWallMs,
      cueCompleteLogged,
    };

    let lastEasingAuditCueBucket = -1;
    let lastEasingAuditObjBucket = -1;
    let lastEasingAuditObj2Bucket = -1;
    let lastObj2ReachVerboseBucket = -1;
    let lastObj2MotionVerboseBucket = -1;

    const stepPlayback = (now: number) => {
      const wallMs = now - start;
      const cueMotionDone = wallMs >= tCueTotalMs;

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

      if (
        isPathPlaybackEasingAuditEnabled() &&
        process.env.NODE_ENV !== "production"
      ) {
        const auditCueBucket = Math.floor(wallMs / 80);
        if (auditCueBucket !== lastEasingAuditCueBucket) {
          lastEasingAuditCueBucket = auditCueBucket;
          const polyLen = cuePlan.pathLengthPx;
          const tauFrac = tCueTotalMs > 1e-9 ? cueWallForMotion / tCueTotalMs : 1;
          const distIfLinearTau = tauFrac * polyLen;
          console.debug("[path-playback:easing-audit:cue]", {
            wallMs: Math.round(wallMs),
            playbackEasingDisabled,
            rawProgress: Number(cueRawProgress.toFixed(4)),
            easedProgress: Number(cueEasedProgress.toFixed(4)),
            motionMs: Number(cueWallForMotion.toFixed(2)),
            dAlongRaw: Number(dAlongRaw.toFixed(2)),
            distIfLinearTau: Number(distIfLinearTau.toFixed(2)),
            tauDistanceIsLinearInTau: Math.abs(dAlongRaw - distIfLinearTau) < 1,
            cueCap: Number(cueCap.toFixed(2)),
            dCue: Number(dCue.toFixed(2)),
            progress01: Number(cueProgress01.toFixed(4)),
            cueAlongRatio: Number(cueAlongRatio.toFixed(4)),
            nearFullTauAlong: dAlongRaw >= cueAlongMax - 0.5,
          });
        }
      }

      const HIT_REACH_EPS_PX = 0.35;
      /**
       * 스팟 중심: 기하·곡선 재생에서 1.5px만으로는 한 프레임 건너뛰면 영구 미달될 수 있어 재생만 여유를 둔다.
       * 거리: `dAlongRaw`(τ raw)와 `dCue`(화면)는 cap 스케일에서 어긋날 수 있어 **둘 중 하나**로 맞춤 거리 도달을 본다.
       */
      const troubleSpotAlignEpsPx = Math.max(PLAYBACK_SPOT_CENTER_ALIGN_EPS_PX, 4);
      const cueNorm = sampleCueMotion(cuePlan, cueProgress01, rect).normalized;

      const firstHitCueCenterAligned =
        firstObjectCueHitSpotCenterNorm == null
          ? true
          : distanceNormPointsInPlayfieldPx(cueNorm, firstObjectCueHitSpotCenterNorm, rect) <=
            troubleSpotAlignEpsPx;

      const rawReachFirst = dAlongRaw + HIT_REACH_EPS_PX >= reachTargetPx;
      const displayReachFirst = dCue + HIT_REACH_EPS_PX >= reachTargetPx;
      /** τ·화면 거리가 둘 다 1목 맞춤에 이르면 스팟 epsilon 한 프레임 미스여도 출발(1목 정지 방지). */
      const distanceSyncedFirstHit = rawReachFirst && displayReachFirst;

      const reachedFirstObjectHit =
        hasReflectionPath &&
        Boolean(objPlan) &&
        Boolean(playbackData.reflectionObjectBall) &&
        (firstObjectCueHitSpotCenterNorm == null
          ? displayReachFirst
          : (firstHitCueCenterAligned && (rawReachFirst || displayReachFirst)) ||
            distanceSyncedFirstHit);

      /** 2목 맞춤이 1목보다 앞선 px로 잡히면 1목 충돌 전에 2목만 열리므로, 1목 접촉 거리 통과 전에는 2목 금지. */
      const cuePastFirstObjectContact =
        objectStarted ||
        dAlongRaw + HIT_REACH_EPS_PX >= reachTargetPx ||
        dCue + HIT_REACH_EPS_PX >= reachTargetPx;

      /**
       * 2목만: 접촉 시에도 곡선·`sampleCueMotion` vs 스팟 중심 오차로 `troubleSpotAlignEpsPx`에 못 들어오는 경우가 있어
       * 1목과 별도로 허용 거리를 잡는다. (여전히 거리 맞춤만으로는 열지 않음 — 중심 근접 필수.)
       */
      const troubleSecondSpotAlignEpsPx = Math.max(
        troubleSpotAlignEpsPx,
        getBallRadius(getPlayfieldLongSide(rect)) * 0.5
      );
      const secondHitCueCenterAligned =
        secondObjectCueHitSpotCenterNorm == null
          ? false
          : distanceNormPointsInPlayfieldPx(cueNorm, secondObjectCueHitSpotCenterNorm, rect) <=
            troubleSecondSpotAlignEpsPx;

      const reachedSecondObjectHit =
        hasSecondReflectionPath &&
        Boolean(obj2Plan) &&
        Boolean(playbackData.secondReflectionObjectBall) &&
        cuePastFirstObjectContact &&
        secondObjectCueHitSpotCenterNorm != null &&
        secondHitCueCenterAligned;

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

      const cuePathOverlapWithFirstObjectSegment =
        hasReflectionPath &&
        objPlan != null &&
        switchIgnoreKey != null &&
        cuePathOverlapsObjectPathAtCueDistancePx(
          cuePlan.polylineNormalized,
          dCue,
          objPlan.polylineNormalized,
          rect
        );

      if (cueMotionDone && !cueCompleteLogged) {
        cueCompleteLogged = true;
        const rel = now - start;
        setPlaybackTimingDebug((d) => (d ? { ...d, cueCompleteRelMs: rel } : null));
      }

      const overrides: BallNormOverrides = { [cueKey]: cueNorm };

      let tObj01 = 0;
      let tObj201 = 0;
      if (hasReflectionPath && objPlan && playbackData.reflectionObjectBall) {
        if (reachedFirstObjectHit) {
          if (!objectStarted) {
            objectStarted = true;
            objectStartWallMs = wallMs;
            commitPlaybackPhase("object");
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
          const objElapsed = wallMs - (objectStartWallMs ?? wallMs);
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

          if (
            isPathPlaybackEasingAuditEnabled() &&
            process.env.NODE_ENV !== "production"
          ) {
            const auditObjBucket = Math.floor(objElapsed / 80);
            if (auditObjBucket !== lastEasingAuditObjBucket) {
              lastEasingAuditObjBucket = auditObjBucket;
              const polyLen = objPlan.pathLengthPx;
              const tauFrac = tObjTotalMs > 1e-9 ? objMotionMs / tObjTotalMs : 1;
              const distIfLinearTau = tauFrac * polyLen;
              console.debug("[path-playback:easing-audit:object1]", {
                wallMs: Math.round(wallMs),
                objElapsed: Math.round(objElapsed),
                playbackEasingDisabled,
                rawProgress: Number(objRawProgress.toFixed(4)),
                easedProgress: Number(objEasedProgress.toFixed(4)),
                motionMs: Number(objMotionMs.toFixed(2)),
                dObjRaw: Number(dObjRaw.toFixed(2)),
                distIfLinearTau: Number(distIfLinearTau.toFixed(2)),
                tauDistanceIsLinearInTau: Math.abs(dObjRaw - distIfLinearTau) < 1,
                objCap: Number(objCap.toFixed(2)),
                dObj: Number(dObj.toFixed(2)),
                progress01: Number(tObj01.toFixed(4)),
                objAlongRatio: Number(objAlongRatio.toFixed(4)),
                nearFullTauAlong: dObjRaw >= objAlongMax - 0.5,
              });
            }
          }

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

      /**
       * 2목 재생: **시작**만 `reachedSecondObjectHit`(수구·스팟)으로 잠근다.
       * 이후 프레임도 동일 조건을 요구하면 수구가 스팟을 지난 뒤 샘플 위치가 멀어지는 순간
       * `overrides`에 2목 키가 빠져 화면에서 멈춘 것처럼 보인다.
       */
      if (hasSecondReflectionPath && obj2Plan && playbackData.secondReflectionObjectBall) {
        if (isTroublePlaybackVerboseLogEnabled() && reachedSecondObjectHit) {
          const vb = Math.floor(wallMs / 200);
          if (vb !== lastObj2ReachVerboseBucket) {
            lastObj2ReachVerboseBucket = vb;
            console.debug("[OBJ2] reachedSecondObjectHit", {
              wallMs: Math.round(wallMs),
              dAlongRaw: Number(dAlongRaw.toFixed(2)),
              reachTarget2CuePx: Number(reachTarget2CuePx.toFixed(2)),
              secondHitCueCenterAligned,
              object2Started,
            });
          }
        }

        if (reachedSecondObjectHit && !object2Started) {
          object2Started = true;
          object2StartWallMs = wallMs;
          commitPlaybackPhase("object2");
          setPlaybackTimingDebug((d) =>
            d
              ? {
                  ...d,
                  playbackPhaseAtEnd: "object2",
                }
              : null
          );
          if (isTroublePlaybackVerboseLogEnabled()) {
            console.debug("[OBJ2] phase entered", {
              wallMs: Math.round(wallMs),
              secondKey: playbackData.secondReflectionObjectBall,
              tObj2TotalMs,
              obj2SegLensLen: obj2SegLens.length,
              obj2Cap: Math.min(obj2Plan.moveDistancePx, obj2Plan.pathLengthPx),
            });
          }
        }

        if (object2Started) {
          const obj2Elapsed = wallMs - (object2StartWallMs ?? wallMs);
          const obj2RawProgress = tObj2TotalMs > 0 ? clamp01(obj2Elapsed / tObj2TotalMs) : 1;
          const obj2EasedProgress = playbackEasingDisabled
            ? obj2RawProgress
            : easeOutObject(obj2RawProgress);
          const obj2MotionMs = obj2EasedProgress * tObj2TotalMs;
          const dObj2Raw = distancePxAfterTimeMsAlongVariableEdgeTimes(
            obj2MotionMs,
            obj2SegLens,
            obj2SegmentTimesMs
          );
          const obj2Cap = Math.min(obj2Plan.moveDistancePx, obj2Plan.pathLengthPx);
          const obj2AlongRatio = clamp01(dObj2Raw / obj2AlongMax);
          const dObj2 = obj2Cap * obj2AlongRatio;
          tObj201 = obj2Cap > 0 ? dObj2 / obj2Cap : 1;
          const obj2Pos = sampleObjectMotion(obj2Plan, tObj201, rect);
          overrides[playbackData.secondReflectionObjectBall] = obj2Pos.normalized;

          if (isTroublePlaybackVerboseLogEnabled()) {
            const pb = Math.floor(obj2Elapsed / 150);
            if (pb !== lastObj2MotionVerboseBucket) {
              lastObj2MotionVerboseBucket = pb;
              console.debug("[OBJ2] tObj201 sampled live override", {
                tObj201: Number(tObj201.toFixed(4)),
                dObj2Raw: Number(dObj2Raw.toFixed(2)),
                obj2AlongRatio: Number(obj2AlongRatio.toFixed(4)),
                pos: {
                  x: Number(obj2Pos.normalized.x.toFixed(5)),
                  y: Number(obj2Pos.normalized.y.toFixed(5)),
                },
                key: playbackData.secondReflectionObjectBall,
              });
            }
          }

          if (
            isPathPlaybackEasingAuditEnabled() &&
            process.env.NODE_ENV !== "production"
          ) {
            const auditObj2Bucket = Math.floor(obj2Elapsed / 80);
            if (auditObj2Bucket !== lastEasingAuditObj2Bucket) {
              lastEasingAuditObj2Bucket = auditObj2Bucket;
              const polyLen = obj2Plan.pathLengthPx;
              const tauFrac = tObj2TotalMs > 1e-9 ? obj2MotionMs / tObj2TotalMs : 1;
              const distIfLinearTau = tauFrac * polyLen;
              console.debug("[path-playback:easing-audit:object2]", {
                wallMs: Math.round(wallMs),
                obj2Elapsed: Math.round(obj2Elapsed),
                playbackEasingDisabled,
                rawProgress: Number(obj2RawProgress.toFixed(4)),
                easedProgress: Number(obj2EasedProgress.toFixed(4)),
                motionMs: Number(obj2MotionMs.toFixed(2)),
                dObj2Raw: Number(dObj2Raw.toFixed(2)),
                distIfLinearTau: Number(distIfLinearTau.toFixed(2)),
                tauDistanceIsLinearInTau: Math.abs(dObj2Raw - distIfLinearTau) < 1,
                obj2Cap: Number(obj2Cap.toFixed(2)),
                dObj2: Number(dObj2.toFixed(2)),
                progress01: Number(tObj201.toFixed(4)),
                obj2AlongRatio: Number(obj2AlongRatio.toFixed(4)),
                nearFullTauAlong: dObj2Raw >= obj2AlongMax - 0.5,
              });
            }
          }
        }
      }

      writeBallNormOverridesRefOnly(overrides);

      const needsObjectPhase =
        hasReflectionPath && Boolean(objPlan) && Boolean(playbackData.reflectionObjectBall);
      const objectPhaseComplete =
        !needsObjectPhase ||
        (objectStartWallMs != null && wallMs >= objectStartWallMs + tObjTotalMs) ||
        /** 맞춤 실패 시 rAF가 무한히 돌고 3초 복귀 타이머가 안 돌아가므로, 수구 타임라인 종료 후에도 미출발이면 페이즈 완료 처리 */
        (cueMotionDone && !objectStarted && needsObjectPhase);

      const needsObject2Phase =
        hasSecondReflectionPath && Boolean(obj2Plan) && Boolean(playbackData.secondReflectionObjectBall);
      const object2PhaseComplete =
        !needsObject2Phase ||
        (object2StartWallMs != null && wallMs >= object2StartWallMs + tObj2TotalMs) ||
        (cueMotionDone && !object2Started && needsObject2Phase);

      const playbackDone = cueMotionDone && objectPhaseComplete && object2PhaseComplete;

      if (collisionWarningsEnabled) {
        if (!cueMotionDone) {
          if (
            cuePhaseCollisionWithOthers(cueNorm, placement, rect, {
              neverWarnWhenTouchingBallKeys: secondObjectKey ? [secondObjectKey] : [],
              firstObjectBallKey: switchIgnoreKey ?? null,
              cuePathProgress01: traveledFrac,
              warnReContactAfterProgress: pWarnRecontactAfter,
              cuePathOverlapWithFirstObjectSegment,
              initialTouchingPairs,
            })
          ) {
            setCollisionMessage(COLLISION_POPUP_MESSAGE);
            setPlaybackPaused(false);
            commitPlaybackPhase("idle");
            isPlayingRef.current = false;
            {
              const snap = ballNormOverridesRef.current;
              flushCommittedBallNormOverrides(snap ? { ...snap } : null);
            }
            setPlaybackTimingDebug((d) =>
              d
                ? {
                    ...d,
                    warningTriggeredRelMs: now - start,
                    playbackPhaseAtEnd: "idle",
                  }
                : null
            );
            frameRef.current = 0;
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
            setPlaybackPaused(false);
            commitPlaybackPhase("idle");
            isPlayingRef.current = false;
            {
              const snap = ballNormOverridesRef.current;
              flushCommittedBallNormOverrides(snap ? { ...snap } : null);
            }
            setPlaybackTimingDebug((d) =>
              d
                ? {
                    ...d,
                    warningTriggeredRelMs: now - start,
                    playbackPhaseAtEnd: "idle",
                  }
                : null
            );
            frameRef.current = 0;
            return;
          }
        }

        if (object2Started && obj2Plan && playbackData.secondReflectionObjectBall) {
          const skipEarly = tObj201 < 0.12;
          const obj2Norm = overrides[playbackData.secondReflectionObjectBall]!;
          if (
            objectPhaseCollisionWithOthers(
              obj2Norm,
              playbackData.secondReflectionObjectBall,
              placement,
              cueNorm,
              rect,
              skipEarly,
              tObj201,
              { initialTouchingPairs }
            )
          ) {
            setCollisionMessage(COLLISION_POPUP_MESSAGE);
            setPlaybackPaused(false);
            commitPlaybackPhase("idle");
            isPlayingRef.current = false;
            {
              const snap = ballNormOverridesRef.current;
              flushCommittedBallNormOverrides(snap ? { ...snap } : null);
            }
            setPlaybackTimingDebug((d) =>
              d
                ? {
                    ...d,
                    warningTriggeredRelMs: now - start,
                    playbackPhaseAtEnd: "idle",
                  }
                : null
            );
            frameRef.current = 0;
            return;
          }
        }
      }

      timelineScratchRef.current = {
        wallMs,
        objectStarted,
        objectStartWallMs,
        object2Started,
        object2StartWallMs,
        cueCompleteLogged,
      };

      if (!playbackDone) {
        frameRef.current = requestAnimationFrame(stepPlayback);
      } else {
        setPlaybackPaused(false);
        commitPlaybackPhase("idle");
        isPlayingRef.current = false;
        {
          const snap = ballNormOverridesRef.current;
          flushCommittedBallNormOverrides(snap ? { ...snap } : null);
        }
        setPlaybackTimingDebug((d) => (d ? { ...d, playbackPhaseAtEnd: "idle" } : null));
        frameRef.current = 0;
        /** 재생 종료 후 3초간 최종 위치를 보여준 뒤 원래 배치로 복귀 */
        clearRestoreTimer();
        restoreTimerRef.current = window.setTimeout(() => {
          flushCommittedBallNormOverrides(null);
          restoreTimerRef.current = null;
        }, PLAYBACK_RESTORE_DELAY_MS);
      }
    };
    frameRef.current = requestAnimationFrame(stepPlayback);
  }, [cancelRaf, clearRestoreTimer, flushCommittedBallNormOverrides, commitPlaybackPhase]);

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
      playbackRemainingAfterPrePx: cuePlan?.playbackRemainingAfterPrePx,
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
    cuePlan?.playbackRemainingAfterPrePx,
  ]);

  const object2PlaybackPathDebug = useMemo(() => {
    if (!playbackData?.secondReflectionPath?.points || playbackData.secondReflectionPath.points.length < 2) {
      return null;
    }
    const obj2Data = {
      ...playbackData,
      reflectionPath: playbackData.secondReflectionPath,
      reflectionObjectBall: playbackData.secondReflectionObjectBall,
    };
    const obj2Plan = buildObjectPathMotionPlan(obj2Data as NanguSolutionData, rect, {
      ...objectPathVizOptions,
      visualizationPlayback: true,
      troublePlaybackModel: true,
      ignorePhysics: Boolean(options.ignorePhysics),
      objectPathCurveControls: options.secondObjectPathCurveControls,
      objectPathCurveNodes: options.secondObjectPathCurveNodes,
    });
    if (!obj2Plan) return null;
    const nc = options.secondObjectPathCurveNodes?.length ?? 0;
    const cc = options.secondObjectPathCurveControls?.length ?? 0;
    return {
      polylineVertexCount: obj2Plan.polylineNormalized.length,
      objectCurveNodeCount: nc,
      objectCurveControlCount: cc,
      hasObjectCurvePlayback: nc > 0 || cc > 0,
    };
  }, [
    playbackData,
    rect,
    objectPathVizOptions,
    options.secondObjectPathCurveControls,
    options.secondObjectPathCurveNodes,
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
    cuePlan?.playbackRemainingAfterPrePx,
    options.ballSpeed,
    options.isBankShot,
    options.thicknessOffsetX,
    options.ignorePhysics,
  ]);

  const object2PlaybackDistanceDebug = useMemo(() => {
    if (!playbackData?.secondReflectionPath?.points || playbackData.secondReflectionPath.points.length < 2) {
      return null;
    }
    const obj2Data = {
      ...playbackData,
      reflectionPath: playbackData.secondReflectionPath,
      reflectionObjectBall: playbackData.secondReflectionObjectBall,
    };
    const obj2Plan = buildObjectPathMotionPlan(obj2Data as NanguSolutionData, rect, {
      ...objectPathVizOptions,
      visualizationPlayback: true,
      troublePlaybackModel: true,
      ignorePhysics: Boolean(options.ignorePhysics),
      objectPathCurveControls: options.secondObjectPathCurveControls,
      objectPathCurveNodes: options.secondObjectPathCurveNodes,
    });
    if (!obj2Plan) return null;
    const V =
      getCuePlayableDistanceFromBallSpeed(rect, options.ballSpeed) *
      getThicknessLossRatio(options.isBankShot, options.thicknessOffsetX);
    const playable =
      obj2Plan.playbackObjectPlayableDistancePx ?? V;
    return {
      playableDistancePx: playable,
      objectDistanceFromHitPx: playable,
      polylineLengthPx: obj2Plan.pathLengthPx,
      effectiveTravelLengthPx: obj2Plan.effectiveTravelPx,
      stopsEarly: obj2Plan.effectiveTravelPx + 1e-3 < obj2Plan.pathLengthPx,
      curveDampingMeanCoefficient: obj2Plan.playbackCurveDampingMeanCoefficient ?? null,
      curveSegmentCount: obj2Plan.playbackCurveDampingCurveSegmentCount ?? null,
      effectivePolylineLengthPx: obj2Plan.playbackEffectivePathCostPx ?? null,
      curveDampingApplied: obj2Plan.playbackCurveDampingApplied ?? false,
    };
  }, [
    playbackData,
    rect,
    objectPathVizOptions,
    options.secondObjectPathCurveControls,
    options.secondObjectPathCurveNodes,
    options.ballSpeed,
    options.isBankShot,
    options.thicknessOffsetX,
    options.ignorePhysics,
  ]);

  const canPlayback = Boolean(options.ballPlacement && playbackData && cuePlan);

  const isPlaybackActive = playbackPhase !== "idle" && collisionMessage === null;
  const stoppedOnCollision = collisionMessage !== null && committedBallNormOverrides !== null;

  return {
    ballNormOverrides: committedBallNormOverrides,
    ballNormOverridesLiveRef: ballNormOverridesRef,
    playbackPhase,
    collisionMessage,
    dismissCollisionMessage,
    startPlayback,
    pausePlayback,
    resetPlayback,
    canPlayback,
    isPlaybackActive,
    isPlaybackPaused: playbackPaused,
    stoppedOnCollision,
    playbackTimingDebug,
    playbackReflectionMeta,
    cuePlaybackPathDebug,
    objectPlaybackPathDebug,
    cuePlaybackDistanceDebug,
    objectPlaybackDistanceDebug,
    object2PlaybackPathDebug,
    object2PlaybackDistanceDebug,
  };
}

