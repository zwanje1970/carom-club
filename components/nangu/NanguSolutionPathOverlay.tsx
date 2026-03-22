"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  getPlayfieldRect,
  normalizedToPixel,
  getBallRadius,
  getPlayfieldLongSide,
  distanceNormPointsInPlayfieldPx,
  getSolutionPathBallTapRadiusPx,
  isInsidePlayfield,
  pixelToNormalized,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  landscapeToPortraitNorm,
  portraitToLandscapeNorm,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import { useSolutionTableZoomContext } from "@/components/nangu/solution-table-zoom-context";
import { spotCenterNormForDraw } from "@/lib/path-spot-display";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguPathPoint,
  type ObjectBallColorKey,
} from "@/lib/nangu-types";
import { isLastSegmentEndpointSpotIndex, type PathPointerAim } from "@/lib/cue-path-cushion-rules";
import { classifySolutionPathPointerHit } from "@/lib/solution-path-pointer-classify";
import {
  ballCircumferenceNormFacingApproach,
  cueFirstObjectHitAmongNormalized,
} from "@/lib/solution-path-geometry";
import { outwardOffsetFromBallCenterTowardPointNorm } from "@/lib/path-motion-geometry";
import { buildCuePathSegments, buildObjectPathSegments } from "@/lib/solution-path-types";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import {
  type PathSegmentCurveControl,
  cueSegmentCurveKey,
  objectSegmentCurveKey,
  isValidCueCurveKey,
  isValidObjectCurveKey,
} from "@/lib/path-curve-display";

/** 수구 진행 경로 */
const CUE_PATH_STROKE = "rgb(239, 68, 68)";
/** 1목적구(반사) 진행 경로 — 진한 파랑 */
const OBJECT_PATH_STROKE = "rgb(29, 78, 216)";
const LINE_WIDTH = 2.5;
/** 수구 경로 스팟: 공과 동일 반지름 — 깜빡임은 `fillOpacity`에 곱함 */
const SPOT_FILL = CUE_PATH_STROKE;
const SPOT_FILL_OPACITY = 0.7;
/** 1목 경로 스팟: 경로선과 동일 진한 파랑·60% 불투명 */
const OBJECT_SPOT_FILL = OBJECT_PATH_STROKE;
const OBJECT_SPOT_FILL_OPACITY = 0.6;

const CURVE_HANDLE_HIT_PX = 26;
const CURVE_LONG_PRESS_MS = 480;
const CURVE_HANDLE_MOVE_CANCEL_PX = 10;

/**
 * 수구 경로(빨강) + 1목적구 경로(진한 파랑).
 * - 수구 경로: 첫 선분은 항상 **수구**에서 시작(`buildCuePathSegments`).
 * - 첫 스팟은 **1목 후보(수구 제외 2구 중 하나)** 또는 **플레이필드·쿠션 경계**; 마지막 세그먼트 끝 **화살표는 그리지 않음**.
 * - 1목 경로는 충돌점에서 시작.
 */
export function NanguSolutionPathOverlay({
  pathPoints,
  cuePos,
  objectBallNorm,
  objectPathPoints = [],
  /** 캔버스와 동일 — portrait 시 테이블 긴 변이 세로(당구노트 공배치 전체화면과 동일) */
  orientation = "landscape" as TableOrientation,
  pathMode = false,
  objectPathMode = false,
  getNormalizedFromEvent,
  /** 플레이필드 내 norm | 테이블 캔버스(px) — 쿠션·프레임 탭 시 반직선 교차용 */
  getPointerAimFromEvent,
  onAddPoint,
  onAddCuePathAim,
  onInsertCuePathAim,
  onRemovePoint,
  onMovePoint,
  onInsertBetween,
  onAddObjectPoint,
  onAddObjectPathAim,
  onRemoveObjectPoint,
  onMoveObjectPoint,
  onPathSpotDragStart,
  onPathSpotDragEnd,
  onInsertObjectBetween,
  onInsertObjectPathAim,
  pathLinesVisible = true,
  /** 경로 입력 모드에서 공 탭 시 줌 초점(캔버스 픽셀) */
  onZoomSetFocusCanvasPx,
  /** 공 탭 히트용 배치 (오버레이와 동일 width/height 좌표계) */
  ballPickLayout,
  /** 충돌·1목 경로 표시용 — 미리보기 등 `ballPickLayout`이 없을 때도 `getNonCueBallNorms`에 사용 */
  tableBallPlacement,
  ballNormOverrides,
  /** 경로 입력 모드가 꺼져 있어도 수구 탭 히트(노트 전체화면 재생 UX) */
  allowCuePlaybackGestures = false,
  /** 수구 단일 탭(예: 재생 종료 후 원위치) */
  onCueBallSingleTap,
  /** 수구 더블 탭(예: 재생 후 재시작) */
  onCueBallDoubleTap,
  /** null이면 마지막 끝 스팟만 활성 — 다른 스팟 더블클릭 시 전환 */
  cueActiveSpotOverrideId = null,
  objectActiveSpotOverrideId = null,
  onCueActiveSpotChange,
  onObjectActiveSpotChange,
  cueDisplayCurveControls = [],
  objectDisplayCurveControls = [],
  troubleCurveEditMode = false,
  curveHandleInteraction = false,
  curveHandlesShowSubtle = false,
  onUpsertCueDisplayCurve,
  onUpsertObjectDisplayCurve,
  onMoveCueDisplayCurve,
  onMoveObjectDisplayCurve,
  onRemoveCueDisplayCurve,
  onRemoveObjectDisplayCurve,
  onCurveHandleDragBegin,
}: {
  pathPoints: NanguPathPoint[];
  cuePos: { x: number; y: number };
  /** 레거시: 배치 없이 빨간 공만 알 때 */
  objectBallNorm?: { x: number; y: number } | null;
  objectPathPoints?: NanguPathPoint[];
  /** landscape: 긴 변 가로. portrait: 당구노트 공배치 전체화면과 같이 긴 변 세로 */
  orientation?: TableOrientation;
  pathMode?: boolean;
  objectPathMode?: boolean;
  getNormalizedFromEvent?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  getPointerAimFromEvent?: (clientX: number, clientY: number) => PathPointerAim | null;
  onAddPoint?: (norm: { x: number; y: number }) => void;
  onAddCuePathAim?: (aim: PathPointerAim) => void;
  onInsertCuePathAim?: (segmentIndex: number, aim: PathPointerAim) => void;
  onRemovePoint?: (id: string) => void;
  onMovePoint?: (id: string, norm: { x: number; y: number }) => void;
  onInsertBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
  onAddObjectPoint?: (norm: { x: number; y: number }) => void;
  onAddObjectPathAim?: (aim: PathPointerAim) => void;
  onRemoveObjectPoint?: (id: string) => void;
  onMoveObjectPoint?: (id: string, norm: { x: number; y: number }) => void;
  /** 활성 스팟 드래그 시작 직전 — 되돌리기용 스냅샷 1회 */
  onPathSpotDragStart?: (kind: "cue" | "object", spotId: string) => void;
  onPathSpotDragEnd?: () => void;
  onInsertObjectBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
  onInsertObjectPathAim?: (segmentIndex: number, aim: PathPointerAim) => void;
  /** false면 경로선·스팟·수구 보조 링 숨김 (재생 중 토글) */
  pathLinesVisible?: boolean;
  onZoomSetFocusCanvasPx?: (canvasX: number, canvasY: number) => void;
  ballPickLayout?: NanguBallPlacement | null;
  tableBallPlacement?: NanguBallPlacement | null;
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  allowCuePlaybackGestures?: boolean;
  onCueBallSingleTap?: () => void;
  onCueBallDoubleTap?: () => void;
  cueActiveSpotOverrideId?: string | null;
  objectActiveSpotOverrideId?: string | null;
  onCueActiveSpotChange?: (id: string | null) => void;
  onObjectActiveSpotChange?: (id: string | null) => void;
  /** 표시 전용 곡선 제어점(직선 pathPoints와 분리) */
  cueDisplayCurveControls?: PathSegmentCurveControl[];
  objectDisplayCurveControls?: PathSegmentCurveControl[];
  /**
   * true: 난구 곡선 편집 모드 — 선분 더블탭 시 스팟 삽입 대신 곡선 노드 생성/이동.
   * false: 기존처럼 선분 더블탭 = 스팟 삽입.
   */
  troubleCurveEditMode?: boolean;
  /** 곡선 노드 드래그·삭제·선분 더블탭(곡선 모드) */
  curveHandleInteraction?: boolean;
  /** 편집 모드가 아닐 때 약한 노드 표시(미리보기 등) */
  curveHandlesShowSubtle?: boolean;
  onUpsertCueDisplayCurve?: (key: string, norm: { x: number; y: number }) => void;
  onUpsertObjectDisplayCurve?: (key: string, norm: { x: number; y: number }) => void;
  onMoveCueDisplayCurve?: (key: string, norm: { x: number; y: number }) => void;
  onMoveObjectDisplayCurve?: (key: string, norm: { x: number; y: number }) => void;
  onRemoveCueDisplayCurve?: (key: string) => void;
  onRemoveObjectDisplayCurve?: (key: string) => void;
  /** 곡선 노드 드래그 시작 시(되돌리기 스냅샷용) */
  onCurveHandleDragBegin?: () => void;
}) {
  /** 저장/충돌 계산은 항상 landscape 플레이필드 기준 */
  const collisionRect = useMemo(
    () => getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    []
  );
  const canvasW = orientation === "portrait" ? DEFAULT_TABLE_HEIGHT : DEFAULT_TABLE_WIDTH;
  const canvasH = orientation === "portrait" ? DEFAULT_TABLE_WIDTH : DEFAULT_TABLE_HEIGHT;
  const drawRect = useMemo(() => getPlayfieldRect(canvasW, canvasH), [canvasW, canvasH]);
  const ballR = getBallRadius(getPlayfieldLongSide(drawRect));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  const lastClickRef = useRef<{ id: string; t: number; kind: "cue" | "obj" } | null>(null);
  const segmentDblRef = useRef<{ key: string; t: number } | null>(null);
  /** 곡선 편집 모드 전용 — `segmentDblRef`와 분리(직선 삽입과 동시 타이밍 충돌 방지) */
  const curveSegmentDblRef = useRef<{ key: string; t: number } | null>(null);
  /** 브라우저 setTimeout 핸들 (number). Node `Timeout`과 병합 타입 충돌 방지 */
  const cueBallGestureRef = useRef<{ t: number; timer: number } | null>(null);
  const [draggingCurve, setDraggingCurve] = useState<null | { kind: "cue" | "object"; key: string }>(
    null
  );
  const curveHandleLastTapRef = useRef<{ kind: "cue" | "object"; key: string; t: number } | null>(
    null
  );
  const curveLongPressRef = useRef<{
    kind: "cue" | "object";
    key: string;
    timer: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      const p = cueBallGestureRef.current;
      if (p?.timer) clearTimeout(p.timer);
      const lp = curveLongPressRef.current;
      if (lp?.timer) window.clearTimeout(lp.timer);
    };
  }, []);

  const toPx = useCallback(
    (x: number, y: number) => {
      const n = orientation === "portrait" ? landscapeToPortraitNorm(x, y) : { x, y };
      const { px, py } = normalizedToPixel(n.x, n.y, drawRect);
      return { px, py };
    },
    [orientation, drawRect]
  );

  /** SolutionTableZoomShell 안에서 줌 컨텍스트 사용 — 부모 ref 미동기화·프로덕션 타이밍 이슈로 좌표가 null 되는 경우 방지 */
  const zoomFromShell = useSolutionTableZoomContext();
  const playfieldRectForPointer = useMemo(
    () =>
      orientation === "portrait"
        ? getPlayfieldRect(DEFAULT_TABLE_HEIGHT, DEFAULT_TABLE_WIDTH)
        : getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    [orientation]
  );

  const resolvePointerAimFromClient = useCallback(
    (clientX: number, clientY: number): PathPointerAim | null => {
      if (zoomFromShell?.viewportClientToCanvasPx) {
        const cp = zoomFromShell.viewportClientToCanvasPx(clientX, clientY);
        if (!cp) return null;
        if (cp.x < -2 || cp.y < -2 || cp.x > canvasW + 2 || cp.y > canvasH + 2) return null;
        if (isInsidePlayfield(cp.x, cp.y, playfieldRectForPointer)) {
          const vn = pixelToNormalized(cp.x, cp.y, playfieldRectForPointer);
          const land = orientation === "portrait" ? portraitToLandscapeNorm(vn.x, vn.y) : vn;
          return { kind: "playfield", norm: land };
        }
        return { kind: "tableCanvas", cx: cp.x, cy: cp.y };
      }
      if (getPointerAimFromEvent) return getPointerAimFromEvent(clientX, clientY);
      if (getNormalizedFromEvent) {
        const n = getNormalizedFromEvent(clientX, clientY);
        return n ? { kind: "playfield", norm: n } : null;
      }
      return null;
    },
    [
      zoomFromShell,
      canvasW,
      canvasH,
      playfieldRectForPointer,
      orientation,
      getPointerAimFromEvent,
      getNormalizedFromEvent,
    ]
  );

  const resolveLandscapeNormFromClient = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const aim = resolvePointerAimFromClient(clientX, clientY);
      if (aim?.kind === "playfield") return aim.norm;
      return null;
    },
    [resolvePointerAimFromClient]
  );

  const firstObjectBallsForCollision = useMemo(() => {
    const src = tableBallPlacement ?? ballPickLayout ?? null;
    if (src) return getNonCueBallNorms(src);
    if (objectBallNorm) return [{ key: "red" as const, x: objectBallNorm.x, y: objectBallNorm.y }];
    return null;
  }, [tableBallPlacement, ballPickLayout, objectBallNorm]);

  /** 스팟 원이 목적구(비수구) 원을 침범하지 않도록 — 오버레이·선 끝점 공통 */
  const spotDrawOpts = useMemo(
    () =>
      firstObjectBallsForCollision?.length
        ? { objectBallNorms: firstObjectBallsForCollision.map((b) => ({ x: b.x, y: b.y })) }
        : undefined,
    [firstObjectBallsForCollision]
  );

  /** 수구→첫 스팟 광선의 1목 충돌점(저장 좌표계=landscape). 스팟 표시는 `collisionRect`로 계산해야 선·스팟이 맞음 */
  const cueFirstHit = useMemo(() => {
    if (!firstObjectBallsForCollision?.length || pathPoints.length < 1) return null;
    return cueFirstObjectHitAmongNormalized(
      cuePos,
      pathPoints[0],
      firstObjectBallsForCollision,
      collisionRect
    );
  }, [firstObjectBallsForCollision, pathPoints, cuePos, collisionRect]);

  const collisionNorm = cueFirstHit?.collision ?? null;

  /**
   * 수구 경로 스팟이 없을 때 — `SolutionPathEditorFullscreen.cueToFirstObjectHit`와 동일한 가상 접점.
   * (스팟만 object 경로에 있을 때 파란 선이 `collisionNorm` 없이 비지 않게)
   */
  const cuePathEmptyVirtualHitNorm = useMemo(() => {
    if (pathPoints.length >= 1) return null;
    const placement = tableBallPlacement ?? ballPickLayout ?? null;
    if (!placement) return null;
    const nonCue = getNonCueBallNorms(placement);
    if (nonCue.length === 0) return null;
    let nearest = nonCue[0]!;
    let bestD = Infinity;
    for (const b of nonCue) {
      const d = distanceNormPointsInPlayfieldPx(cuePos, { x: b.x, y: b.y }, collisionRect);
      if (d < bestD) {
        bestD = d;
        nearest = b;
      }
    }
    return ballCircumferenceNormFacingApproach({ x: nearest.x, y: nearest.y }, cuePos, collisionRect);
  }, [pathPoints.length, tableBallPlacement, ballPickLayout, cuePos, collisionRect]);

  /** 1목 경로 시작 구슬: 스팟으로 확정된 1목만 — 광선·거리 폴백 없음 (`lib/trouble-first-object-ball`) */
  const placementForFirstObject = tableBallPlacement ?? ballPickLayout ?? null;
  const resolvedFirstObjectBallKey = useMemo((): ObjectBallColorKey | null => {
    if (!placementForFirstObject) return null;
    return resolveTroubleFirstObjectBallKey({
      placement: placementForFirstObject,
      cuePos,
      pathPoints,
      objectPathPoints,
      rect: collisionRect,
    });
  }, [placementForFirstObject, cuePos, pathPoints, objectPathPoints, collisionRect]);

  const objectPathLineStartNorm = useMemo(() => {
    if (!resolvedFirstObjectBallKey || !firstObjectBallsForCollision) return null;
    const b = firstObjectBallsForCollision.find((x) => x.key === resolvedFirstObjectBallKey);
    return b ? { x: b.x, y: b.y } : null;
  }, [resolvedFirstObjectBallKey, firstObjectBallsForCollision]);

  /** 경로선은 스팟 원 중심(쿠션 clamp + 목적구 원 비침범 보정)까지만 이어짐 — 저장 좌표와 다를 수 있음 */
  const cueSpotDisplayNorms = useMemo(
    () =>
      pathPoints.map((p, i) => {
        const struck =
          i === 0 &&
          p.type === "ball" &&
          cueFirstHit &&
          firstObjectBallsForCollision
            ? firstObjectBallsForCollision.find((b) => b.key === cueFirstHit.objectKey) ?? null
            : null;
        return spotCenterNormForDraw(p, collisionRect, {
          ...spotDrawOpts,
          ...(struck ? { cueFirstSpotStruckBallNorm: { x: struck.x, y: struck.y } } : {}),
        });
      }),
    [pathPoints, collisionRect, spotDrawOpts, cueFirstHit, firstObjectBallsForCollision]
  );

  const cueSegmentsNorm = useMemo(
    () => buildCuePathSegments(cuePos, cueSpotDisplayNorms),
    [cuePos, cueSpotDisplayNorms]
  );

  const objectSpotDisplayNorms = useMemo(
    () => objectPathPoints.map((p) => spotCenterNormForDraw(p, collisionRect, spotDrawOpts)),
    [objectPathPoints, collisionRect, spotDrawOpts]
  );

  /** 표시 전용 시작점 — 재생·경고와 무관 (`objectPathPoints` 있으면 선을 그릴 수 있게 분기) */
  const objectPathRenderStartNorm =
    objectPathLineStartNorm ?? collisionNorm ?? cuePathEmptyVirtualHitNorm;

  const objectSegmentsNorm = useMemo(() => {
    if (objectSpotDisplayNorms.length < 1) return [];
    if (!objectPathRenderStartNorm) return [];
    return buildObjectPathSegments(objectPathRenderStartNorm, objectSpotDisplayNorms);
  }, [objectPathRenderStartNorm, objectSpotDisplayNorms]);

  /**
   * 공 캔버스가 경로(z-10)보다 위(z-20)일 때, 중심→첫점 선분이 공 아래에 가려지지 않도록
   * 첫 선분 시작만 공 외곽으로 보정 (레이어 뒤집기 없음).
   */
  const cueSegmentsNormForDraw = useMemo(() => {
    if (cueSegmentsNorm.length < 1) return cueSegmentsNorm;
    const first = { ...cueSegmentsNorm[0]! };
    first.start = outwardOffsetFromBallCenterTowardPointNorm(
      first.start,
      first.end,
      collisionRect
    );
    return [first, ...cueSegmentsNorm.slice(1)];
  }, [cueSegmentsNorm, collisionRect]);

  const objectSegmentsNormForDraw = useMemo(() => {
    if (objectSegmentsNorm.length < 1) return objectSegmentsNorm;
    const first = { ...objectSegmentsNorm[0]! };
    first.start = outwardOffsetFromBallCenterTowardPointNorm(
      first.start,
      first.end,
      collisionRect
    );
    return [first, ...objectSegmentsNorm.slice(1)];
  }, [objectSegmentsNorm, collisionRect]);

  const cuePxSegs = useMemo(
    () =>
      cueSegmentsNormForDraw.map((s) => ({
        x1: toPx(s.start.x, s.start.y).px,
        y1: toPx(s.start.x, s.start.y).py,
        x2: toPx(s.end.x, s.end.y).px,
        y2: toPx(s.end.x, s.end.y).py,
      })),
    [cueSegmentsNormForDraw, toPx]
  );

  const objectPxSegs = useMemo(
    () =>
      objectSegmentsNormForDraw.map((s) => ({
        x1: toPx(s.start.x, s.start.y).px,
        y1: toPx(s.start.x, s.start.y).py,
        x2: toPx(s.end.x, s.end.y).px,
        y2: toPx(s.end.x, s.end.y).py,
      })),
    [objectSegmentsNormForDraw, toPx]
  );

  const cueCurveByKey = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const c of cueDisplayCurveControls) {
      if (isValidCueCurveKey(c.key, pathPoints)) m.set(c.key, { x: c.x, y: c.y });
    }
    return m;
  }, [cueDisplayCurveControls, pathPoints]);

  const objectCurveByKey = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const c of objectDisplayCurveControls) {
      if (isValidObjectCurveKey(c.key, objectPathPoints)) m.set(c.key, { x: c.x, y: c.y });
    }
    return m;
  }, [objectDisplayCurveControls, objectPathPoints]);

  const cueSegmentRender = useMemo(() => {
    return cuePxSegs.map((seg, i) => {
      const sk = cueSegmentCurveKey(pathPoints, i);
      const ctrl = sk ? cueCurveByKey.get(sk) : undefined;
      if (!ctrl) {
        return { mode: "line" as const, i, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 };
      }
      const cp = toPx(ctrl.x, ctrl.y);
      return {
        mode: "quad" as const,
        i,
        x1: seg.x1,
        y1: seg.y1,
        cx: cp.px,
        cy: cp.py,
        x2: seg.x2,
        y2: seg.y2,
      };
    });
  }, [cuePxSegs, pathPoints, cueCurveByKey, toPx]);

  const objectSegmentRender = useMemo(() => {
    return objectPxSegs.map((seg, i) => {
      const sk = objectSegmentCurveKey(objectPathPoints, i);
      const ctrl = sk ? objectCurveByKey.get(sk) : undefined;
      if (!ctrl) {
        return { mode: "line" as const, i, x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 };
      }
      const cp = toPx(ctrl.x, ctrl.y);
      return {
        mode: "quad" as const,
        i,
        x1: seg.x1,
        y1: seg.y1,
        cx: cp.px,
        cy: cp.py,
        x2: seg.x2,
        y2: seg.y2,
      };
    });
  }, [objectPxSegs, objectPathPoints, objectCurveByKey, toPx]);

  /** 항상 활성 스팟은 1개 — 기본은 각 경로의 마지막 끝 스팟 */
  const effectiveCueActiveId = useMemo(() => {
    if (pathPoints.length === 0) return null;
    return cueActiveSpotOverrideId ?? pathPoints[pathPoints.length - 1]!.id;
  }, [pathPoints, cueActiveSpotOverrideId]);

  const effectiveObjectActiveId = useMemo(() => {
    if (objectPathPoints.length === 0) return null;
    return objectActiveSpotOverrideId ?? objectPathPoints[objectPathPoints.length - 1]!.id;
  }, [objectPathPoints, objectActiveSpotOverrideId]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const aim = resolvePointerAimFromClient(e.clientX, e.clientY);
      if (!aim) return;
      const now = Date.now();

      if (aim.kind === "tableCanvas") {
        const { cx, cy } = aim;
        if (ballPickLayout && onZoomSetFocusCanvasPx) {
          const rb = ballNormOverrides?.red ?? ballPickLayout.redBall;
          const yb = ballNormOverrides?.yellow ?? ballPickLayout.yellowBall;
          const wb = ballNormOverrides?.white ?? ballPickLayout.whiteBall;
          const ballTapR = getSolutionPathBallTapRadiusPx(collisionRect);
          const cueBall = ballPickLayout.cueBall === "yellow" ? "yellow" : "white";
          const isCueBallKey = (key: "red" | "yellow" | "white") =>
            key !== "red" && key === cueBall;
          for (const { key, b } of [
            { key: "red" as const, b: rb },
            { key: "yellow" as const, b: yb },
            { key: "white" as const, b: wb },
          ]) {
            const { px, py } = toPx(b.x, b.y);
            if (Math.hypot(cx - px, cy - py) <= ballTapR) {
              /** 1목 경로: 목적구 탭은 스팟 — 수구 탭만 줌 */
              if (objectPathMode && collisionNorm && onAddObjectPathAim && !isCueBallKey(key)) {
                onAddObjectPathAim(aim);
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              /** 수구 경로: 목적구 넓은 터치 반경 → 반직선 스냅으로 스팟(수구 탭만 줌) */
              if (pathMode && onAddCuePathAim && !isCueBallKey(key)) {
                onAddCuePathAim(aim);
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              onZoomSetFocusCanvasPx(px, py);
              e.stopPropagation();
              e.preventDefault();
              return;
            }
          }
        }
        if (objectPathMode && collisionNorm && onAddObjectPathAim) {
          onAddObjectPathAim(aim);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (pathMode && onAddCuePathAim) {
          onAddCuePathAim(aim);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        return;
      }

      const norm = aim.norm;

      /** 곡선 노드(드래그·더블탭 삭제·길게 눌러 삭제) — 활성 경로 레이어만 */
      if (curveHandleInteraction && pathLinesVisible && aim.kind === "playfield") {
        const tryHit = (
          kind: "cue" | "object",
          list: PathSegmentCurveControl[],
          valid: (key: string) => boolean,
          onRemove?: (key: string) => void
        ): boolean => {
          for (const ctl of list) {
            if (!valid(ctl.key)) continue;
            if (
              distanceNormPointsInPlayfieldPx(norm, { x: ctl.x, y: ctl.y }, collisionRect) >
              CURVE_HANDLE_HIT_PX
            ) {
              continue;
            }
            const prev = curveHandleLastTapRef.current;
            if (prev && prev.kind === kind && prev.key === ctl.key && now - prev.t < 420) {
              curveHandleLastTapRef.current = null;
              if (curveLongPressRef.current?.timer) window.clearTimeout(curveLongPressRef.current.timer);
              curveLongPressRef.current = null;
              setDraggingCurve(null);
              onRemove?.(ctl.key);
              e.preventDefault();
              e.stopPropagation();
              return true;
            }
            curveHandleLastTapRef.current = { kind, key: ctl.key, t: now };
            if (curveLongPressRef.current?.timer) window.clearTimeout(curveLongPressRef.current.timer);
            onCurveHandleDragBegin?.();
            const k = ctl.key;
            const tRef = curveLongPressRef;
            const timer = window.setTimeout(() => {
              if (tRef.current?.key === k) {
                onRemove?.(k);
                setDraggingCurve(null);
                tRef.current = null;
              }
            }, CURVE_LONG_PRESS_MS);
            curveLongPressRef.current = {
              kind,
              key: k,
              timer,
              startClientX: e.clientX,
              startClientY: e.clientY,
            };
            setDraggingCurve({ kind, key: k });
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            e.preventDefault();
            e.stopPropagation();
            return true;
          }
          return false;
        };

        if (pathMode && !objectPathMode) {
          const stopped = tryHit(
            "cue",
            cueDisplayCurveControls,
            (key) => isValidCueCurveKey(key, pathPoints),
            onRemoveCueDisplayCurve
          );
          if (stopped) return;
        }
        if (objectPathMode && !pathMode) {
          const stopped = tryHit(
            "object",
            objectDisplayCurveControls,
            (key) => isValidObjectCurveKey(key, objectPathPoints),
            onRemoveObjectDisplayCurve
          );
          if (stopped) return;
        }
      }

      const c = classifySolutionPathPointerHit({
        norm,
        pathMode,
        objectPathMode,
        cuePos,
        pathPoints,
        objectPathPoints,
        objectBallNorm,
        ballPickLayout,
        collisionLayout: tableBallPlacement ?? ballPickLayout ?? null,
        ballNormOverrides,
        width: DEFAULT_TABLE_WIDTH,
        height: DEFAULT_TABLE_HEIGHT,
        allowCuePlaybackGestures: Boolean(allowCuePlaybackGestures),
      });

      if (c.kind === "inactive") return;

      const cueGestureLayout = ballPickLayout ?? tableBallPlacement ?? null;
      const hasCuePlaybackHandlers = Boolean(onCueBallSingleTap || onCueBallDoubleTap);
      let isCueBallHitForGesture = c.kind === "cueBallPlayback";
      if (!isCueBallHitForGesture && c.kind === "ball" && cueGestureLayout) {
        const ck = cueGestureLayout.cueBall === "yellow" ? "yellow" : ("white" as const);
        const cn =
          ballNormOverrides?.[ck] ??
          (ck === "yellow" ? cueGestureLayout.yellowBall : cueGestureLayout.whiteBall);
        const tapR = getSolutionPathBallTapRadiusPx(collisionRect);
        isCueBallHitForGesture =
          distanceNormPointsInPlayfieldPx(norm, cn, collisionRect) <= tapR;
      }
      if (
        hasCuePlaybackHandlers &&
        cueGestureLayout &&
        pathPoints.length >= 1 &&
        isCueBallHitForGesture
      ) {
        const now = Date.now();
        const prev = cueBallGestureRef.current;
        if (prev && now - prev.t < 400) {
          if (prev.timer) clearTimeout(prev.timer);
          cueBallGestureRef.current = null;
          if (onCueBallDoubleTap) {
            onCueBallDoubleTap();
          } else {
            onCueBallSingleTap?.();
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        const tRef = cueBallGestureRef;
        const timer = window.setTimeout(() => {
          tRef.current = null;
          onCueBallSingleTap?.();
        }, 400);
        cueBallGestureRef.current = { t: now, timer };
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "ball") {
        if (!ballPickLayout || !onZoomSetFocusCanvasPx) return;
        const rb = ballNormOverrides?.red ?? ballPickLayout.redBall;
        const yb = ballNormOverrides?.yellow ?? ballPickLayout.yellowBall;
        const wb = ballNormOverrides?.white ?? ballPickLayout.whiteBall;
        const ballTapR = getSolutionPathBallTapRadiusPx(collisionRect);
        for (const b of [rb, yb, wb]) {
          if (distanceNormPointsInPlayfieldPx(norm, b, collisionRect) <= ballTapR) {
            const { px, py } = toPx(b.x, b.y);
            onZoomSetFocusCanvasPx(px, py);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        return;
      }

      if (c.kind === "objectSpot") {
        const p = objectPathPoints.find((x) => x.id === c.id);
        if (!p) return;
        const objIdx = objectPathPoints.findIndex((x) => x.id === c.id);
        const last = lastClickRef.current;
        if (last?.kind === "obj" && last?.id === p.id && now - last.t < 400) {
          lastClickRef.current = null;
          if (p.id !== effectiveObjectActiveId) {
            onObjectActiveSpotChange?.(p.id);
          } else if (objIdx >= 0 && isLastSegmentEndpointSpotIndex(objectPathPoints, objIdx)) {
            onRemoveObjectPoint?.(p.id);
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        lastClickRef.current = { id: p.id, t: now, kind: "obj" };
        {
          const { px, py } = toPx(p.x, p.y);
          onZoomSetFocusCanvasPx?.(px, py);
        }
        if (p.id === effectiveObjectActiveId) setDraggingObjectId(p.id);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "objectSegment") {
        if (
          troubleCurveEditMode &&
          curveHandleInteraction &&
          objectPathMode &&
          !pathMode
        ) {
          const tkey = `curve-obj-${c.segmentIndex}`;
          const lastC = curveSegmentDblRef.current;
          if (lastC?.key === tkey && now - lastC.t < 420) {
            curveSegmentDblRef.current = null;
            const sk = objectSegmentCurveKey(objectPathPoints, c.segmentIndex);
            if (sk) onUpsertObjectDisplayCurve?.(sk, norm);
          } else {
            curveSegmentDblRef.current = { key: tkey, t: now };
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        const key = `obj-${c.segmentIndex}`;
        const lastS = segmentDblRef.current;
        if (lastS?.key === key && now - lastS.t < 400) {
          segmentDblRef.current = null;
          if (onInsertObjectPathAim) onInsertObjectPathAim(c.segmentIndex, aim);
          else onInsertObjectBetween?.(c.segmentIndex, norm);
        } else {
          segmentDblRef.current = { key, t: now };
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "emptyObject") {
        if (onAddObjectPathAim) onAddObjectPathAim(aim);
        else onAddObjectPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "cueSpot") {
        const p = pathPoints.find((x) => x.id === c.id);
        if (!p) return;
        const last = lastClickRef.current;
        if (last?.kind === "cue" && last?.id === p.id && now - last.t < 400) {
          lastClickRef.current = null;
          if (p.id !== effectiveCueActiveId) {
            onCueActiveSpotChange?.(p.id);
          } else {
            onRemovePoint?.(p.id);
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        lastClickRef.current = { id: p.id, t: now, kind: "cue" };
        {
          const { px, py } = toPx(p.x, p.y);
          onZoomSetFocusCanvasPx?.(px, py);
        }
        if (p.id === effectiveCueActiveId) {
          onPathSpotDragStart?.("cue", p.id);
          setDraggingId(p.id);
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "cueSegment") {
        if (troubleCurveEditMode && curveHandleInteraction && pathMode && !objectPathMode) {
          const tkey = `curve-cue-${c.segmentIndex}`;
          const lastC = curveSegmentDblRef.current;
          if (lastC?.key === tkey && now - lastC.t < 420) {
            curveSegmentDblRef.current = null;
            const sk = cueSegmentCurveKey(pathPoints, c.segmentIndex);
            if (sk) onUpsertCueDisplayCurve?.(sk, norm);
          } else {
            curveSegmentDblRef.current = { key: tkey, t: now };
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        const key = `cue-${c.segmentIndex}`;
        const lastS = segmentDblRef.current;
        if (lastS?.key === key && now - lastS.t < 400) {
          segmentDblRef.current = null;
          if (onInsertCuePathAim) onInsertCuePathAim(c.segmentIndex, aim);
          else onInsertBetween?.(c.segmentIndex, norm);
        } else {
          segmentDblRef.current = { key, t: now };
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "emptyCue" || c.kind === "pathObjectBallTap") {
        /** 마지막이 쿠션(스팟점)이면 플레이필드 어디를 탭해도 스냅 기준으로 다음 스팟 연결 — 반직선 실패 없이 */
        const lastCue = pathPoints[pathPoints.length - 1];
        if (lastCue?.type === "cushion") {
          const n = resolveLandscapeNormFromClient(e.clientX, e.clientY);
          if (n) {
            onAddPoint?.(n);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        if (onAddCuePathAim) onAddCuePathAim(aim);
        else onAddPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [
      pathMode,
      objectPathMode,
      resolvePointerAimFromClient,
      resolveLandscapeNormFromClient,
      pathPoints,
      objectPathPoints,
      cuePos,
      objectBallNorm,
      tableBallPlacement,
      onAddPoint,
      onAddCuePathAim,
      onInsertCuePathAim,
      onRemovePoint,
      onInsertBetween,
      onAddObjectPoint,
      onAddObjectPathAim,
      onRemoveObjectPoint,
      onPathSpotDragStart,
      onInsertObjectBetween,
      onInsertObjectPathAim,
      ballPickLayout,
      ballNormOverrides,
      onZoomSetFocusCanvasPx,
      toPx,
      collisionRect,
      collisionNorm,
      allowCuePlaybackGestures,
      onCueBallSingleTap,
      onCueBallDoubleTap,
      effectiveCueActiveId,
      effectiveObjectActiveId,
      onCueActiveSpotChange,
      onObjectActiveSpotChange,
      curveHandleInteraction,
      pathLinesVisible,
      cueDisplayCurveControls,
      objectDisplayCurveControls,
      troubleCurveEditMode,
      onRemoveCueDisplayCurve,
      onRemoveObjectDisplayCurve,
      onUpsertCueDisplayCurve,
      onUpsertObjectDisplayCurve,
      onCurveHandleDragBegin,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingCurve) {
        const norm = resolveLandscapeNormFromClient(e.clientX, e.clientY);
        if (norm) {
          if (draggingCurve.kind === "cue") onMoveCueDisplayCurve?.(draggingCurve.key, norm);
          else onMoveObjectDisplayCurve?.(draggingCurve.key, norm);
        }
        const lp = curveLongPressRef.current;
        if (
          lp &&
          (Math.abs(e.clientX - lp.startClientX) > CURVE_HANDLE_MOVE_CANCEL_PX ||
            Math.abs(e.clientY - lp.startClientY) > CURVE_HANDLE_MOVE_CANCEL_PX)
        ) {
          window.clearTimeout(lp.timer);
          curveLongPressRef.current = null;
        }
        e.preventDefault();
        return;
      }
      const norm = resolveLandscapeNormFromClient(e.clientX, e.clientY);
      if (!norm) return;
      if (draggingObjectId && onMoveObjectPoint) {
        onMoveObjectPoint(draggingObjectId, norm);
        e.preventDefault();
        return;
      }
      if (draggingId && onMovePoint) {
        onMovePoint(draggingId, norm);
        e.preventDefault();
      }
    },
    [
      draggingCurve,
      draggingId,
      draggingObjectId,
      resolveLandscapeNormFromClient,
      onMovePoint,
      onMoveObjectPoint,
      onMoveCueDisplayCurve,
      onMoveObjectDisplayCurve,
    ]
  );

  const handlePointerUp = useCallback(() => {
    const lp = curveLongPressRef.current;
    if (lp?.timer) window.clearTimeout(lp.timer);
    curveLongPressRef.current = null;
    setDraggingCurve(null);
    const wasDragging = draggingId != null || draggingObjectId != null;
    setDraggingId(null);
    setDraggingObjectId(null);
    if (wasDragging) onPathSpotDragEnd?.();
  }, [draggingId, draggingObjectId, onPathSpotDragEnd]);

  const interactive = pathMode || objectPathMode || Boolean(allowCuePlaybackGestures);

  /** 이동 가능한 스팟만 깜빡임에 사용 — `Date.now()/180` 기준 sin 부호 → 0|1 (`BilliardTableCanvas` showCueBallSpot) */
  const [spotBlink01, setSpotBlink01] = useState(1);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const t = Date.now() / 180;
      setSpotBlink01(Math.sin(t) >= 0 ? 1 : 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      data-testid="nangu-solution-path-overlay"
      data-cue-path-segment-count={cuePxSegs.length}
      data-object-path-segment-count={objectPxSegs.length}
      data-object-path-points-len={objectPathPoints.length}
      data-first-object-ball-key={resolvedFirstObjectBallKey ?? "none"}
      data-object-path-start-ready={objectPathRenderStartNorm ? "1" : "0"}
      data-object-line-visible={
        pathLinesVisible && objectPxSegs.length > 0 ? "1" : "0"
      }
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        width={canvasW}
        height={canvasH}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        {/* 수구 경로 — 제어점 있으면 2차 베지어(표시 전용) */}
        {pathLinesVisible &&
          cueSegmentRender.map((seg) =>
            seg.mode === "line" ? (
              <line
                key={`cue-seg-${seg.i}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={CUE_PATH_STROKE}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
              />
            ) : (
              <path
                key={`cue-seg-${seg.i}`}
                d={`M ${seg.x1} ${seg.y1} Q ${seg.cx} ${seg.cy} ${seg.x2} ${seg.y2}`}
                fill="none"
                stroke={CUE_PATH_STROKE}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
              />
            )
          )}
        {/* 1목적구 경로 */}
        {pathLinesVisible &&
          objectSegmentRender.map((seg) =>
            seg.mode === "line" ? (
              <line
                key={`obj-seg-${seg.i}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={OBJECT_PATH_STROKE}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
              />
            ) : (
              <path
                key={`obj-seg-${seg.i}`}
                d={`M ${seg.x1} ${seg.y1} Q ${seg.cx} ${seg.cy} ${seg.x2} ${seg.y2}`}
                fill="none"
                stroke={OBJECT_PATH_STROKE}
                strokeWidth={LINE_WIDTH}
                strokeLinecap="round"
              />
            )
          )}
        {(curveHandleInteraction || curveHandlesShowSubtle) &&
          pathLinesVisible &&
          cueDisplayCurveControls.map((ctl) => {
            if (!isValidCueCurveKey(ctl.key, pathPoints)) return null;
            const { px, py } = toPx(ctl.x, ctl.y);
            const subtle = !curveHandleInteraction || !pathMode || objectPathMode;
            return (
              <circle
                key={`cue-curve-ctl-${ctl.key}`}
                cx={px}
                cy={py}
                r={subtle ? 3.5 : 6}
                fill={subtle ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.92)"}
                stroke={CUE_PATH_STROKE}
                strokeWidth={subtle ? 1 : 1.5}
                opacity={subtle ? 0.55 : 1}
              />
            );
          })}
        {(curveHandleInteraction || curveHandlesShowSubtle) &&
          pathLinesVisible &&
          objectDisplayCurveControls.map((ctl) => {
            if (!isValidObjectCurveKey(ctl.key, objectPathPoints)) return null;
            const { px, py } = toPx(ctl.x, ctl.y);
            const subtle = !curveHandleInteraction || !objectPathMode || pathMode;
            return (
              <circle
                key={`obj-curve-ctl-${ctl.key}`}
                cx={px}
                cy={py}
                r={subtle ? 3.5 : 6}
                fill={subtle ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.92)"}
                stroke={OBJECT_PATH_STROKE}
                strokeWidth={subtle ? 1 : 1.5}
                opacity={subtle ? 0.55 : 1}
              />
            );
          })}
        {/*
          수구/1목 “깜빡이는 점선”은 BilliardTableCanvas(showCueBallSpot·showObjectBallSpot) 전용.
          원래 위치는 재생 시 ballNormOverrides + BilliardTableCanvas 반투명 고정 공(ghost)만 사용.
          SVG에 공 중심 실선 링을 두면 현재 공과 겹쳐 고정 테두리처럼 보이므로 여기서는 그리지 않음.
        */}

        {/* 수구 경로 스팟 */}
        {pathLinesVisible &&
          pathPoints.map((p, i) => {
          const n = cueSpotDisplayNorms[i]!;
          const { px, py } = toPx(n.x, n.y);
          const blinkFactor = p.id === effectiveCueActiveId ? spotBlink01 : 1;
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r={ballR}
              fill={SPOT_FILL}
              fillOpacity={SPOT_FILL_OPACITY * blinkFactor}
            />
          );
        })}

        {/* 1목 경로 스팟 — 마지막 세그먼트 양끝만 깜빡임·드래그·삭제(수구 경로와 동일) */}
        {pathLinesVisible &&
          objectPathPoints.map((p, i) => {
          const n = objectSpotDisplayNorms[i]!;
          const { px, py } = toPx(n.x, n.y);
          const blinkFactor = p.id === effectiveObjectActiveId ? spotBlink01 : 1;
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r={ballR}
              fill={OBJECT_SPOT_FILL}
              fillOpacity={OBJECT_SPOT_FILL_OPACITY * blinkFactor}
            />
          );
        })}
      </svg>
    </div>
  );
}
