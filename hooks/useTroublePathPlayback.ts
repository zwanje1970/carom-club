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
  distancePxAfterTimeMsAlongEqualEdgeTimes,
  timeMsForDistanceAlongEqualEdgeTimes,
  troublePlaybackSpeedFactorFromRailCount,
} from "@/lib/trouble-playback-rail-timing";
import { polylineSegmentLengthsPx } from "@/lib/path-motion-geometry";
import {
  buildCuePathMotionPlan,
  buildObjectPathMotionPlan,
  buildObjectPathMotionPlanWithStartVertex,
  computeCueProgress01ForFirstObjectHitAlongFullPath,
  sampleCueMotion,
  sampleObjectMotion,
} from "@/lib/solution-path-motion";
import { cueFirstObjectHitFromBallPlacement } from "@/lib/solution-path-geometry";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import { getCuePlayableDistanceFromBallSpeed } from "@/lib/trouble-playback-distance";
import { getThicknessLossRatio } from "@/lib/trouble-thickness-split";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";

export const COLLISION_POPUP_MESSAGE = "異⑸룎??諛쒖깮?섏??듬땲??" as const;

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

function ballCenterNormForKey(
  placement: NanguBallPlacement,
  key: "red" | "yellow" | "white"
): NormPoint {
  if (key === "red") return { x: placement.redBall.x, y: placement.redBall.y };
  if (key === "yellow") return { x: placement.yellowBall.x, y: placement.yellowBall.y };
  return { x: placement.whiteBall.x, y: placement.whiteBall.y };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** 전체 구간 단일 자연 감속(ease-out), 마지막 0.5%는 1로 스냅 */
function easeOutPower135(t: number): number {
  const x = clamp01(t);
  if (x >= 0.995) return 1;
  return 1 - Math.pow(1 - x, 3);
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
  /**
   * ?뚮뜑쨌1紐??섏씠?쇱씠?몄? ?숈씪: `type==="ball"` ?ㅽ뙚 ?쒖꽌(`resolveTroubleFirstObjectBallKey`).
   * 愿묒꽑 湲고븯留??곕㈃ ?ㅽ뙚? ?덈뒗??`cueFirstObjectHitFromBallPlacement`媛 null??寃쎌슦 reflectionPath媛
   * ??留뚮뱾?댁졇 ?뚮? ?좊쭔 蹂댁씠怨??ъ깮 ??1紐⑹씠 ???吏곸씠??遺덉씪移섍? ?쒕떎.
   */
  const resolvedStruckKey = resolveTroubleFirstObjectBallKey({
    placement: ballPlacement,
    cuePos,
    pathPoints,
    objectPathPoints,
    rect,
  });
  const struckKey = resolvedStruckKey ?? firstHit?.objectKey ?? null;

  let reflectionPath: NanguSolutionData["reflectionPath"];
  /** points[0] = 1紐?**以묒떖** ??異⑸룎 norm ?щ?? 臾닿?, ?ㅽ뙚?쇰줈 ?뺤젙??struckKey留??덉쑝硫?援ъ꽦 */
  if (struckKey && objectPathPoints.length >= 1) {
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
    /** ?ъ깮 ??寃쎈줈瑜??곕씪 ?吏곸씪 怨???誘몄?????red濡??섎せ ?≫? 1紐⑹씠 ???吏곸씤 寃껋쿂??蹂댁엫 */
    reflectionObjectBall: reflectionPath && struckKey ? struckKey : undefined,
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
    setPlaybackTimingDebug(null);
  }, [cancelRaf]);

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

  useEffect(() => () => cancelRaf(), [cancelRaf]);

  const startPlayback = useCallback(() => {
    const placement = options.ballPlacement;
    if (!placement || !playbackData || !cuePlan) return;
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

    /** ?뚮? 寃쎈줈 ?쒖옉?? 1紐?以묒떖(?섍뎄 ?꾩튂? ?낅┰) */
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
    const railCount = ballSpeedToRailCount(options.ballSpeed);
    const speedFactor = ignorePhy ? 1 : troublePlaybackSpeedFactorFromRailCount(railCount);
    const dHit = pHitFirst * dTotal;
    const cueEdges = Math.max(1, segmentLens.length);
    const objSegLens = objPlan ? polylineSegmentLengthsPx(objPlan.polylineNormalized, rect) : [];
    const objEdges = Math.max(1, objSegLens.length);

    let timePerRailMsCue: number;
    let timePerRailMsObj: number;
    let tCueTotalMs: number;
    let tObjTotalMs: number;

    const cueDurationSourcePx = Math.max(1, cuePlan.effectiveTravelPx);
    const baseCueDurationMs = Math.max(1, Math.round(computePolylinePlaybackDurationMs(cueDurationSourcePx, rect)));
    tCueTotalMs = Math.max(1, Math.round(baseCueDurationMs / speedFactor));
    timePerRailMsCue = tCueTotalMs / cueEdges;
    const objectDurationSourcePx = hasReflectionPath && objPlan ? Math.max(1, objPlan.effectiveTravelPx) : 0;
    const baseObjectDurationMs =
      objectDurationSourcePx > 0 ? Math.max(1, Math.round(computePolylinePlaybackDurationMs(objectDurationSourcePx, rect))) : 0;
    tObjTotalMs =
      objectDurationSourcePx > 0 ? Math.max(1, Math.round(baseObjectDurationMs / speedFactor)) : 0;
    timePerRailMsObj = tObjTotalMs > 0 ? tObjTotalMs / objEdges : 1;

    const tHitMs = timeMsForDistanceAlongEqualEdgeTimes(dHit, segmentLens, timePerRailMsCue);
    const totalWallMs = Math.max(tCueTotalMs, tHitMs + tObjTotalMs);
    const cueAlongMaxRaw = distancePxAfterTimeMsAlongEqualEdgeTimes(
      tCueTotalMs,
      segmentLens,
      timePerRailMsCue
    );
    const cueAlongMax = Math.max(1e-6, cueAlongMaxRaw);
    const objAlongMaxRaw =
      tObjTotalMs > 0
        ? distancePxAfterTimeMsAlongEqualEdgeTimes(tObjTotalMs, objSegLens, timePerRailMsObj)
        : 0;
    const objAlongMax = Math.max(1e-6, objAlongMaxRaw);

    if (process.env.NODE_ENV !== "production") {
      console.debug("[trouble-playback:rail-time]", {
        railCount,
        speedFactor,
        timePerRail: null,
        totalDuration: totalWallMs / 1000,
        ignorePhysics: ignorePhy,
        averageCueSpeedPxPerMs: cuePlan.effectiveTravelPx / Math.max(1, tCueTotalMs),
      });
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
     * ?ㅼ쐞移?1紐⑷낵???섎룄??泥??묒큺): ?섍뎄 愿묒꽑??癒쇱? 留욌뒗 1紐??꾨낫 ???섍뎄 援ш컙 ?꾩껜?먯꽌 ?대떦 怨듦낵??留욌떯?뚯? 異⑸룎濡?蹂댁? ?딆쓬.
     * (?ㅽ뙚 洹쇱쿂 8px 議곌굔? ?쒖떆 醫뚰몴쨌?ㅽ뙚 蹂댁젙 李⑤줈 ?ㅽ깘???섏? ?쒓굅??)
     */
    const cuePosStart =
      placement.cueBall === "yellow" ? placement.yellowBall : placement.whiteBall;
    const firstHitInfo = cueFirstObjectHitFromBallPlacement(
      cuePosStart,
      options.pathPoints[0]!,
      placement,
      rect
    );
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
      const cueEasedProgress = easeOutPower135(cueRawProgress);
      const cueWallForMotion = cueEasedProgress * tCueTotalMs;
      const dAlongRaw = distancePxAfterTimeMsAlongEqualEdgeTimes(
        cueWallForMotion,
        segmentLens,
        timePerRailMsCue
      );
      const cueCap = Math.min(cuePlan.moveDistancePx, cuePlan.pathLengthPx);
      const cueAlongRatio = clamp01(dAlongRaw / cueAlongMax);
      const dCue = cueCap * cueAlongRatio;
      const cueProgress01 = cueCap > 0 ? dCue / cueCap : 1;
      const cueNorm = sampleCueMotion(cuePlan, cueProgress01, rect).normalized;
      if (process.env.NODE_ENV !== "production") {
        const cueBucket = Math.floor(cueRawProgress * 10);
        const nearTail = cueRawProgress >= 0.85;
        if (nearTail || cueBucket !== lastCueLogBucket) {
          lastCueLogBucket = cueBucket;
          console.debug("[trouble-playback:ease-cue]", {
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
          const objEasedProgress = easeOutPower135(objRawProgress);
          const objMotionMs = objEasedProgress * tObjTotalMs;
          const dObjRaw = distancePxAfterTimeMsAlongEqualEdgeTimes(
            objMotionMs,
            objSegLens,
            timePerRailMsObj
          );
          const objCap = Math.min(objPlan.moveDistancePx, objPlan.pathLengthPx);
          const objAlongRatio = clamp01(dObjRaw / objAlongMax);
          const dObj = objCap * objAlongRatio;
          tObj01 = objCap > 0 ? dObj / objCap : 1;
          const objPos = sampleObjectMotion(objPlan, tObj01, rect);
          overrides[movingKey] = objPos.normalized;
          if (process.env.NODE_ENV !== "production") {
            const objBucket = Math.floor(objRawProgress * 10);
            const nearTail = objRawProgress >= 0.85;
            if (nearTail || objBucket !== lastObjLogBucket) {
              lastObjLogBucket = objBucket;
              console.debug("[trouble-playback:ease-object]", {
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

