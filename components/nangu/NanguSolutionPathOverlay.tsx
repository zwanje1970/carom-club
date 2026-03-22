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
import { cueFirstObjectHitAmongNormalized } from "@/lib/solution-path-geometry";
import { buildCuePathSegments, buildObjectPathSegments } from "@/lib/solution-path-types";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";

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
  /** 브라우저 setTimeout 핸들 (number). Node `Timeout`과 병합 타입 충돌 방지 */
  const cueBallGestureRef = useRef<{ t: number; timer: number } | null>(null);

  useEffect(() => {
    return () => {
      const p = cueBallGestureRef.current;
      if (p?.timer) clearTimeout(p.timer);
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

  const objectSegmentsNorm = useMemo(() => {
    if (objectSpotDisplayNorms.length < 1) return [];
    if (objectPathMode && objectPathLineStartNorm) {
      return buildObjectPathSegments(objectPathLineStartNorm, objectSpotDisplayNorms);
    }
    /** 1목 중심에서 파란 경로 시작 — 충돌점(수구 접촉 시 수구 중심 근처)이 아님 */
    if (objectPathLineStartNorm) {
      return buildObjectPathSegments(objectPathLineStartNorm, objectSpotDisplayNorms);
    }
    if (!collisionNorm) return [];
    return buildObjectPathSegments(collisionNorm, objectSpotDisplayNorms);
  }, [objectPathMode, objectPathLineStartNorm, collisionNorm, objectSpotDisplayNorms]);

  const cuePxSegs = useMemo(
    () =>
      cueSegmentsNorm.map((s) => ({
        x1: toPx(s.start.x, s.start.y).px,
        y1: toPx(s.start.x, s.start.y).py,
        x2: toPx(s.end.x, s.end.y).px,
        y2: toPx(s.end.x, s.end.y).py,
      })),
    [cueSegmentsNorm, toPx]
  );

  const objectPxSegs = useMemo(
    () =>
      objectSegmentsNorm.map((s) => ({
        x1: toPx(s.start.x, s.start.y).px,
        y1: toPx(s.start.x, s.start.y).py,
        x2: toPx(s.end.x, s.end.y).px,
        y2: toPx(s.end.x, s.end.y).py,
      })),
    [objectSegmentsNorm, toPx]
  );

  const cuePx = toPx(cuePos.x, cuePos.y);

  const objectPathHighlightPx = useMemo(
    () =>
      objectPathLineStartNorm
        ? toPx(objectPathLineStartNorm.x, objectPathLineStartNorm.y)
        : null,
    [objectPathLineStartNorm, toPx]
  );

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
        if (p.id === effectiveCueActiveId) setDraggingId(p.id);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "cueSegment") {
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
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
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
    [draggingId, draggingObjectId, resolveLandscapeNormFromClient, onMovePoint, onMoveObjectPoint]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
    setDraggingObjectId(null);
  }, []);

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
        {/* 수구 경로 */}
        {pathLinesVisible &&
          cuePxSegs.map((seg, i) => (
            <line
              key={`cue-seg-${i}`}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={CUE_PATH_STROKE}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
            />
          ))}
        {/* 1목적구 경로 */}
        {pathLinesVisible &&
          objectPxSegs.map((seg, i) => (
          <line
            key={`obj-seg-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={OBJECT_PATH_STROKE}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
          />
        ))}
        {pathLinesVisible && (
          <g>
            <circle
              cx={cuePx.px}
              cy={cuePx.py}
              r={ballR}
              fill="none"
              stroke="rgba(30, 64, 175, 0.85)"
              strokeWidth={2.5}
            />
          </g>
        )}
        {pathLinesVisible && objectPathMode && objectPathHighlightPx && (
          <g opacity={0.4 + 0.6 * spotBlink01}>
            <circle
              cx={objectPathHighlightPx.px}
              cy={objectPathHighlightPx.py}
              r={ballR}
              fill="none"
              stroke="rgb(29, 78, 216)"
              strokeWidth={2.5}
            />
          </g>
        )}

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
