"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import type { TableDrawStyle } from "@/components/billiard";
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
  playfieldGridOneCellEdgePx,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import { useSolutionTableZoomContext } from "@/components/nangu/solution-table-zoom-context";
import { spotCenterNormForDraw } from "@/lib/path-spot-display";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguCurveNode,
  type NanguPathPoint,
  type ObjectBallColorKey,
} from "@/lib/nangu-types";
import { type PathPointerAim } from "@/lib/cue-path-cushion-rules";
import {
  canActivatePathEditForObjectBallTap,
  classifySolutionPathPointerHit,
} from "@/lib/solution-path-pointer-classify";
import {
  cueFirstObjectHitAmongNormalized,
  resolveEffectiveFirstObjectCollisionFromCuePath,
  resolveEffectiveSecondObjectCollisionFromPaths,
} from "@/lib/solution-path-geometry";
import { outwardOffsetFromBallCenterTowardPointNorm } from "@/lib/path-motion-geometry";
import { buildCuePathSegments, buildObjectPathSegments } from "@/lib/solution-path-types";
import { Search } from "lucide-react";
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
/** 2목적구 진행 경로 — 초록 */
const SECOND_OBJECT_PATH_STROKE = "rgb(34, 197, 94)";
const LINE_WIDTH = 2.5;
/** 수구 경로 스팟: 공과 동일 반지름 — 활성 스팟은 SMIL `<animate>`로 fillOpacity 토글 */
const SPOT_FILL = CUE_PATH_STROKE;
const SPOT_FILL_OPACITY = 0.7;
/** 1목 경로 스팟: 경로선과 동일 진한 파랑·60% 불투명 */
const OBJECT_SPOT_FILL = OBJECT_PATH_STROKE;
const OBJECT_SPOT_FILL_OPACITY = 0.6;
const SECOND_OBJECT_SPOT_FILL = SECOND_OBJECT_PATH_STROKE;
const SECOND_OBJECT_SPOT_FILL_OPACITY = 0.6;
/** 기존 `Math.sin(Date.now()/180)` 한 주기(ms). SMIL `<animate>`로 깜빡임 — rAF·setState 없음 */
const SPOT_BLINK_CYCLE_MS = 2 * Math.PI * 180;

const CURVE_HANDLE_HIT_PX = 26;
/** 3초 이상 누르면 미세조정 UI — 곡선 노드 삭제는 더블탭만 */
const PATH_FINE_TUNE_LONG_PRESS_MS = 3000;
const CURVE_HANDLE_MOVE_CANCEL_PX = 10;
/** 당구노트 공배치와 동일 기준 그리드(80×40)의 1칸 대비 20% — 미세조정 버튼 한 스텝 */
const FINE_TUNE_MOVE_SCALE = 0.2;
const FINE_GRID_STEP_LONG = (1 / 80) * FINE_TUNE_MOVE_SCALE;
const FINE_GRID_STEP_SHORT = (1 / 40) * FINE_TUNE_MOVE_SCALE;
/** 곡선 제어 노드 — 작은 원 + 초록 (수구/1목 공통) */
const CURVE_HANDLE_FILL = "#22c55e";
const CURVE_HANDLE_FILL_SUBTLE = "rgba(34, 197, 94, 0.5)";
const CURVE_HANDLE_STROKE = "#15803d";

function clampCurveControlNormPath(n: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.min(1, Math.max(0, n.x)), y: Math.min(1, Math.max(0, n.y)) };
}

const FT_BTN_CLASS =
  "box-border flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border-0 text-[20px] font-bold leading-none text-white bg-black/40 shadow-md active:bg-black/55 active:scale-[0.97] touch-manipulation select-none";
const FT_SPACER_CLASS = "h-[48px] w-[48px] shrink-0";

type PathFineTuneTarget =
  | { kind: "curve"; curveKind: "cue" | "object"; key: string }
  | { kind: "spot"; spotKind: "cue" | "object" | "object2"; id: string };

/** 스팟 드래그: 롱프레스 후 정밀 이동(속도 감소) */
const SPOT_PRECISION_LONG_PRESS_MS = 300;
/** 정밀모드 전 손가락 이동이 이 이상이면 롱프레스 취소(즉시 일반 드래그) */
const SPOT_PRECISION_MOVE_SLOP_PX = 12;
const SPOT_PRECISION_DELTA_FACTOR = 0.5;
/** 돋보기에 보이는 플레이필드 반경(px, 오버레이 SVG 좌표) — 2배 확대 적용 */
const SPOT_MAGNIFIER_VIEW_RADIUS_PX = 39;
/** 돋보기 고정 뷰포트 박스(px) — 기존 크기 유지 */
const SPOT_MAGNIFIER_BOX_PX = 198;
/** 손가락 위로 띄움 */
const SPOT_MAGNIFIER_ABOVE_FINGER_PX = 148;

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
  secondObjectPathPoints = [],
  /** 캔버스와 동일 — portrait 시 테이블 긴 변이 세로(난구노트 공배치 전체화면과 동일) */
  orientation = "landscape" as TableOrientation,
  pathMode = false,
  objectPathMode = false,
  secondObjectPathMode = false,
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
  onAddSecondObjectPoint,
  onAddSecondObjectPathAim,
  onRemoveSecondObjectPoint,
  onMoveSecondObjectPoint,
  onPathSpotDragStart,
  onPathSpotDragEnd,
  onInsertObjectBetween,
  onInsertObjectPathAim,
  onInsertSecondObjectBetween,
  onInsertSecondObjectPathAim,
  pathLinesVisible = true,
  cuePathLinesVisible: cuePathLinesVisibleProp,
  objectPathLinesVisible: objectPathLinesVisibleProp,
  secondObjectPathLinesVisible: secondObjectPathLinesVisibleProp,
  /** 경로 입력 모드에서 공 탭 시 줌 초점(캔버스 픽셀) */
  onZoomSetFocusCanvasPx,
  /** 공 탭 히트용 배치 (오버레이와 동일 width/height 좌표계) */
  ballPickLayout,
  /** 충돌·1목 경로 표시용 — 미리보기 등 `ballPickLayout`이 없을 때도 `getNonCueBallNorms`에 사용 */
  tableBallPlacement,
  ballNormOverrides,
  /** 경로 입력 모드가 꺼져 있어도 수구 탭 히트(노트 전체화면 재생 UX) */
  allowCuePlaybackGestures = false,
  /** 재생 중일 때만 수구 탭을 cueBallPlayback으로 분류 */
  pathPlaybackActive = false,
  /** 수구 단일 탭 — 재생 중이면 원위치 리셋 등 */
  onCueBallSingleTap,
  /** 수구/1목 공 표식 단일 탭 시 해당 경로 편집 레이어 활성화 */
  onPathEditCueBallTap,
  onPathEditObjectBallTap,
  /** 1목 공 키 — 탭으로 경로 레이어 전환 시 권한 검사(미전달 시 기존 동작) */
  pathEditFirstObjectBallKey,
  /** false면 수구 경로에서 목적구 탭 시 레이어 전환 대신 공 접촉 스팟 추가 */
  objectBallTapSwitchesCueToObjectLayer = true,
  /** null이면 마지막 끝 스팟만 활성 — 다른 스팟 더블클릭 시 전환 */
  cueActiveSpotOverrideId = null,
  objectActiveSpotOverrideId = null,
  secondObjectActiveSpotOverrideId = null,
  onCueActiveSpotChange,
  onObjectActiveSpotChange,
  onSecondObjectActiveSpotChange,
  cueDisplayCurveControls = [],
  objectDisplayCurveControls = [],
  /** 1단계 곡선 노드 — 렌더 시 display 제어점보다 우선 */
  cuePathCurveNodes = [] as NanguCurveNode[],
  objectPathCurveNodes = [] as NanguCurveNode[],
  troubleCurveEditMode = true,
  curveHandleInteraction = false,
  curveHandlesShowSubtle = false,
  onUpsertCueDisplayCurve,
  onUpsertObjectDisplayCurve,
  onMoveCueDisplayCurve,
  onMoveObjectDisplayCurve,
  onRemoveCueDisplayCurve,
  onRemoveObjectDisplayCurve,
  onCurveHandleDragBegin,
  magnifierDrawStyle = "realistic",
  magnifierEnabled = false,
  /** 확대 뷰 `pointerup` onEmptyTap 과 같은 탭에서 이중 스팟 추가 방지 — 경로 추가 직전 pointerId 전달 */
  onPathAppendPointerDown,
}: {
  pathPoints: NanguPathPoint[];
  cuePos: { x: number; y: number };
  /** 레거시: 배치 없이 빨간 공만 알 때 */
  objectBallNorm?: { x: number; y: number } | null;
  objectPathPoints?: NanguPathPoint[];
  secondObjectPathPoints?: NanguPathPoint[];
  /** landscape: 긴 변 가로. portrait: 난구노트 공배치 전체화면과 같이 긴 변 세로 */
  orientation?: TableOrientation;
  pathMode?: boolean;
  objectPathMode?: boolean;
  secondObjectPathMode?: boolean;
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
  onAddSecondObjectPoint?: (norm: { x: number; y: number }) => void;
  onAddSecondObjectPathAim?: (aim: PathPointerAim) => void;
  onRemoveSecondObjectPoint?: (id: string) => void;
  onMoveSecondObjectPoint?: (id: string, norm: { x: number; y: number }) => void;
  /** 활성 스팟 드래그 시작 직전 — 되돌리기용 스냅샷 1회 */
  onPathSpotDragStart?: (kind: "cue" | "object" | "object2", spotId: string) => void;
  onPathSpotDragEnd?: () => void;
  onInsertObjectBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
  onInsertObjectPathAim?: (segmentIndex: number, aim: PathPointerAim) => void;
  onInsertSecondObjectBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
  onInsertSecondObjectPathAim?: (segmentIndex: number, aim: PathPointerAim) => void;
  /** false면 경로선·스팟·수구 보조 링 숨김 (재생 중 토글) */
  pathLinesVisible?: boolean;
  cuePathLinesVisible?: boolean;
  objectPathLinesVisible?: boolean;
  secondObjectPathLinesVisible?: boolean;
  onZoomSetFocusCanvasPx?: (canvasX: number, canvasY: number) => void;
  ballPickLayout?: NanguBallPlacement | null;
  tableBallPlacement?: NanguBallPlacement | null;
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  allowCuePlaybackGestures?: boolean;
  pathPlaybackActive?: boolean;
  onCueBallSingleTap?: () => void;
  onPathEditCueBallTap?: () => void;
  onPathEditObjectBallTap?: () => void;
  pathEditFirstObjectBallKey?: "red" | "yellow" | "white" | null;
  objectBallTapSwitchesCueToObjectLayer?: boolean;
  cueActiveSpotOverrideId?: string | null;
  objectActiveSpotOverrideId?: string | null;
  secondObjectActiveSpotOverrideId?: string | null;
  onCueActiveSpotChange?: (id: string | null) => void;
  onObjectActiveSpotChange?: (id: string | null) => void;
  onSecondObjectActiveSpotChange?: (id: string | null) => void;
  /** 표시 전용 곡선 제어점(직선 pathPoints와 분리) */
  cueDisplayCurveControls?: PathSegmentCurveControl[];
  objectDisplayCurveControls?: PathSegmentCurveControl[];
  cuePathCurveNodes?: NanguCurveNode[];
  objectPathCurveNodes?: NanguCurveNode[];
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
  /** 정밀 확대 배경의 테이블 표시 모드(실사/단순) */
  magnifierDrawStyle?: TableDrawStyle;
  /** 우측 설정에서 켠 경우에만 자동 정밀 확대를 허용 */
  magnifierEnabled?: boolean;
  onPathAppendPointerDown?: (pointerId: number) => void;
}) {
  const cuePathLinesVisible = cuePathLinesVisibleProp ?? pathLinesVisible;
  const objectPathLinesVisible = objectPathLinesVisibleProp ?? pathLinesVisible;
  const secondObjectPathLinesVisible = secondObjectPathLinesVisibleProp ?? pathLinesVisible;
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
  const [draggingSecondObjectId, setDraggingSecondObjectId] = useState<string | null>(null);
  const lastClickRef = useRef<{ id: string; t: number; kind: "cue" | "obj" | "obj2" } | null>(null);
  const segmentDblRef = useRef<{ key: string; t: number } | null>(null);
  /** 곡선 편집 모드 전용 — `segmentDblRef`와 분리(직선 삽입과 동시 타이밍 충돌 방지) */
  const curveSegmentDblRef = useRef<{ key: string; t: number } | null>(null);
  const [draggingCurve, setDraggingCurve] = useState<null | { kind: "cue" | "object"; key: string }>(
    null
  );
  const [spotPrecisionUi, setSpotPrecisionUi] = useState(false);
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

  /** 활성 스팟 드래그 — 정밀모드·델타 보정용 */
  const spotDragPointerNormRef = useRef<{ x: number; y: number } | null>(null);
  const spotDragSpotNormRef = useRef<{ x: number; y: number } | null>(null);
  const spotPrecisionTimerRef = useRef<number | null>(null);
  const spotPrecisionActiveRef = useRef(false);
  const spotPrecisionSlopRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const spotPointerCaptureIdRef = useRef<number | null>(null);
  const curvePointerCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);
  const spotDragCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);
  const spotFineTuneTimerRef = useRef<number | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const draggingObjectIdRef = useRef<string | null>(null);
  const draggingSecondObjectIdRef = useRef<string | null>(null);
  const pathFineTuneTargetRef = useRef<PathFineTuneTarget | null>(null);
  const pathFineTuneDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathFineTuneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathFineTuneDirectionRef = useRef<{ dx: number; dy: number } | null>(null);
  const pathFineTunePressStartRef = useRef(0);
  const pathFineTuneLastMoveRef = useRef(0);
  const pathFineTuneMoveRef = useRef<(dx: number, dy: number) => void>(() => {});

  const [pathFineTuneTarget, setPathFineTuneTarget] = useState<PathFineTuneTarget | null>(null);
  const [pathFineTuneMagnifier, setPathFineTuneMagnifier] = useState(false);
  /** 확대창을 패널 기준으로 드래그 이동(px) */
  const [pathFineTuneFixedCenterNorm, setPathFineTuneFixedCenterNorm] = useState<{x: number, y: number} | null>(null);
  const [pathFineTuneMagOffset, setPathFineTuneMagOffset] = useState({ x: 0, y: 0 });
  const pathFineTuneMagOffsetRef = useRef({ x: 0, y: 0 });
  const pathFineTuneMagDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    pathFineTuneMagOffsetRef.current = pathFineTuneMagOffset;
  }, [pathFineTuneMagOffset]);

  useEffect(() => {
    pathFineTuneTargetRef.current = pathFineTuneTarget;
  }, [pathFineTuneTarget]);

  useEffect(() => {
    return () => {
      const lp = curveLongPressRef.current;
      if (lp?.timer) window.clearTimeout(lp.timer);
      const st = spotPrecisionTimerRef.current;
      if (st != null) window.clearTimeout(st);
      const sft = spotFineTuneTimerRef.current;
      if (sft != null) window.clearTimeout(sft);
      if (pathFineTuneDelayRef.current) {
        clearTimeout(pathFineTuneDelayRef.current);
        pathFineTuneDelayRef.current = null;
      }
      if (pathFineTuneIntervalRef.current) {
        clearInterval(pathFineTuneIntervalRef.current);
        pathFineTuneIntervalRef.current = null;
      }
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

  const clearSpotFineTuneTimer = useCallback(() => {
    const t = spotFineTuneTimerRef.current;
    if (t != null) {
      window.clearTimeout(t);
      spotFineTuneTimerRef.current = null;
    }
  }, []);

  const clearSpotDragGestureState = useCallback(() => {
    clearSpotFineTuneTimer();
    const t = spotPrecisionTimerRef.current;
    if (t != null) window.clearTimeout(t);
    spotPrecisionTimerRef.current = null;
    spotPrecisionActiveRef.current = false;
    spotPrecisionSlopRef.current = null;
    spotDragPointerNormRef.current = null;
    spotDragSpotNormRef.current = null;
    setSpotPrecisionUi(false);
  }, [clearSpotFineTuneTimer]);

  const beginActiveSpotDrag = useCallback(
    (
      e: React.PointerEvent,
      norm: { x: number; y: number },
      spot: { x: number; y: number },
      spotTrack: { spotKind: "cue" | "object" | "object2"; spotId: string }
    ) => {
      clearSpotFineTuneTimer();
      spotDragPointerNormRef.current = { x: norm.x, y: norm.y };
      spotDragSpotNormRef.current = { x: spot.x, y: spot.y };
      spotPrecisionSlopRef.current = { clientX: e.clientX, clientY: e.clientY };
      spotPrecisionActiveRef.current = false;
      setSpotPrecisionUi(false);
      const prevT = spotPrecisionTimerRef.current;
      if (prevT != null) window.clearTimeout(prevT);
      spotPrecisionTimerRef.current = window.setTimeout(() => {
        spotPrecisionTimerRef.current = null;
        spotPrecisionActiveRef.current = true;
        setSpotPrecisionUi(true);
      }, SPOT_PRECISION_LONG_PRESS_MS);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        spotPointerCaptureIdRef.current = e.pointerId;
        spotDragCaptureRef.current = {
          el: e.currentTarget as HTMLElement,
          pointerId: e.pointerId,
        };
      } catch {
        /* ignore */
      }
      const { spotKind, spotId } = spotTrack;
      spotFineTuneTimerRef.current = window.setTimeout(() => {
        spotFineTuneTimerRef.current = null;
        const stillCue = spotKind === "cue" && draggingIdRef.current === spotId;
        const stillObj = spotKind === "object" && draggingObjectIdRef.current === spotId;
        const stillObj2 = spotKind === "object2" && draggingSecondObjectIdRef.current === spotId;
        if (!stillCue && !stillObj && !stillObj2) return;
        const cap = spotDragCaptureRef.current;
        if (cap) {
          try {
            cap.el.releasePointerCapture(cap.pointerId);
          } catch {
            /* ignore */
          }
          spotDragCaptureRef.current = null;
        }
        spotPointerCaptureIdRef.current = null;
        if (spotKind === "cue") {
          draggingIdRef.current = null;
          setDraggingId(null);
        } else if (spotKind === "object") {
          draggingObjectIdRef.current = null;
          setDraggingObjectId(null);
        } else {
          draggingSecondObjectIdRef.current = null;
          setDraggingSecondObjectId(null);
        }
        clearSpotDragGestureState();
        onPathSpotDragEnd?.();
        setPathFineTuneTarget({ kind: "spot", spotKind, id: spotId });
      }, PATH_FINE_TUNE_LONG_PRESS_MS);
    },
    [toPx, clearSpotFineTuneTimer, clearSpotDragGestureState, onPathSpotDragEnd]
  );

  const firstObjectBallsForCollision = useMemo(() => {
    const src = tableBallPlacement ?? ballPickLayout ?? null;
    if (src) return getNonCueBallNorms(src);
    if (objectBallNorm) return [{ key: "red" as const, x: objectBallNorm.x, y: objectBallNorm.y }];
    return null;
  }, [tableBallPlacement, ballPickLayout, objectBallNorm]);
  const magnifierPlacement = useMemo(
    () => tableBallPlacement ?? ballPickLayout ?? null,
    [tableBallPlacement, ballPickLayout]
  );
  const isWireframeMagnifier = magnifierDrawStyle === "wireframe";
  const gridOneCellPx = useMemo(
    () => playfieldGridOneCellEdgePx(collisionRect, orientation === "portrait"),
    [collisionRect, orientation]
  );

  /** 스팟 원이 목적구(비수구) 원을 침범하지 않도록 — 오버레이·선 끝점 공통 */
  const spotDrawOpts = useMemo(
    () =>
      firstObjectBallsForCollision?.length
        ? { objectBallNorms: firstObjectBallsForCollision.map((b) => ({ x: b.x, y: b.y })) }
        : undefined,
    [firstObjectBallsForCollision]
  );

  /** 수구→첫 스팟 광선의 1목 충돌점. 첫 스팟 공 스냅·시각 보조용(폴리라인 닿음과 무관) */
  const cueFirstHit = useMemo(() => {
    if (!firstObjectBallsForCollision?.length || pathPoints.length < 1) return null;
    return cueFirstObjectHitAmongNormalized(
      cuePos,
      pathPoints[0],
      firstObjectBallsForCollision,
      collisionRect
    );
  }, [firstObjectBallsForCollision, pathPoints, cuePos, collisionRect]);

  const placementForFirstObject = tableBallPlacement ?? ballPickLayout ?? null;
  /** 1목 경로·표식·분류 — 수구 폴리라인이 광선상 충돌점에 닿을 때만 */
  const effectiveFirstObjectHit = useMemo(() => {
    if (!placementForFirstObject || pathPoints.length < 1) return null;
    return resolveEffectiveFirstObjectCollisionFromCuePath(
      placementForFirstObject,
      cuePos,
      pathPoints,
      collisionRect
    );
  }, [placementForFirstObject, pathPoints, cuePos, collisionRect]);

  const objectPathCollisionNormForUi = effectiveFirstObjectHit?.collision ?? null;
  const resolvedFirstObjectBallKey: ObjectBallColorKey | null =
    effectiveFirstObjectHit?.objectKey ?? null;

  /** 1목 경로선은 1목적구 중심에서 출발(충돌 접점 아님) */
  const firstObjectBallCenterNorm = useMemo(() => {
    if (!placementForFirstObject) return null;
    const key =
      resolvedFirstObjectBallKey ?? pathEditFirstObjectBallKey ?? cueFirstHit?.objectKey ?? null;
    if (!key) return null;
    const balls = getNonCueBallNorms(placementForFirstObject);
    const b = balls.find((x) => x.key === key);
    return b ? { x: b.x, y: b.y } : null;
  }, [placementForFirstObject, resolvedFirstObjectBallKey, pathEditFirstObjectBallKey, cueFirstHit?.objectKey]);

  const objectPathRenderStartNorm = firstObjectBallCenterNorm ?? objectPathCollisionNormForUi;

  /** 1목 키 — 폴리라인이 충돌에 아직 못 닿아도 광선 1목(cueFirstHit)으로 2목 키 후보 */
  const firstObjectKeyForSecondObject =
    resolvedFirstObjectBallKey ?? pathEditFirstObjectBallKey ?? cueFirstHit?.objectKey ?? null;

  /**
   * 1목 경로상 2목 계산 시작점 — `SolutionPathEditorFullscreen`의 `collisionNorm`과 맞춤(있으면 접촉점 우선).
   * 경로선은 `secondObjectPathRenderStartNorm`(중심 우선)으로 그림.
   */
  const secondObjectGeometryStartNorm =
    objectPathCollisionNormForUi ?? objectPathRenderStartNorm;

  /** 2목 경로·표식 — 수구 또는 1목 경로 스팟 폴리라인이 2목 접촉에 닿을 때 */
  const effectiveSecondObjectHit = useMemo(() => {
    if (!placementForFirstObject || !secondObjectGeometryStartNorm || !firstObjectKeyForSecondObject) return null;
    if (pathPoints.length < 1) return null;
    return resolveEffectiveSecondObjectCollisionFromPaths(
      placementForFirstObject,
      cuePos,
      pathPoints,
      secondObjectGeometryStartNorm,
      objectPathPoints,
      firstObjectKeyForSecondObject,
      collisionRect
    );
  }, [
    placementForFirstObject,
    cuePos,
    pathPoints,
    secondObjectGeometryStartNorm,
    objectPathPoints,
    firstObjectKeyForSecondObject,
    collisionRect,
  ]);

  const secondObjectPathCollisionNormForUi = effectiveSecondObjectHit?.collision ?? null;
  const resolvedSecondObjectBallKey: ObjectBallColorKey | null =
    effectiveSecondObjectHit?.objectKey ?? null;

  const secondObjectBallCenterNorm = useMemo(() => {
    if (!placementForFirstObject || !resolvedSecondObjectBallKey) return null;
    const balls = getNonCueBallNorms(placementForFirstObject);
    const b = balls.find((x) => x.key === resolvedSecondObjectBallKey);
    return b ? { x: b.x, y: b.y } : null;
  }, [placementForFirstObject, resolvedSecondObjectBallKey]);

  const secondObjectPathRenderStartNorm = secondObjectBallCenterNorm ?? secondObjectPathCollisionNormForUi;

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

  const secondObjectSpotDisplayNorms = useMemo(
    () => secondObjectPathPoints.map((p) => spotCenterNormForDraw(p, collisionRect, spotDrawOpts)),
    [secondObjectPathPoints, collisionRect, spotDrawOpts]
  );

  const objectSegmentsNorm = useMemo(() => {
    if (objectSpotDisplayNorms.length < 1) return [];
    if (!objectPathRenderStartNorm) return [];
    return buildObjectPathSegments(objectPathRenderStartNorm, objectSpotDisplayNorms);
  }, [objectPathRenderStartNorm, objectSpotDisplayNorms]);

  const secondObjectSegmentsNorm = useMemo(() => {
    if (secondObjectSpotDisplayNorms.length < 1) return [];
    if (!secondObjectPathRenderStartNorm) return [];
    return buildObjectPathSegments(secondObjectPathRenderStartNorm, secondObjectSpotDisplayNorms);
  }, [secondObjectPathRenderStartNorm, secondObjectSpotDisplayNorms]);

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

  const objectSegmentsNormForDraw = objectSegmentsNorm;
  const secondObjectSegmentsNormForDraw = secondObjectSegmentsNorm;

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

  const secondObjectPxSegs = useMemo(
    () =>
      secondObjectSegmentsNormForDraw.map((s) => ({
        x1: toPx(s.start.x, s.start.y).px,
        y1: toPx(s.start.x, s.start.y).py,
        x2: toPx(s.end.x, s.end.y).px,
        y2: toPx(s.end.x, s.end.y).py,
      })),
    [secondObjectSegmentsNormForDraw, toPx]
  );

  const cueCurveByKey = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const c of cueDisplayCurveControls) {
      if (isValidCueCurveKey(c.key, pathPoints)) m.set(c.key, { x: c.x, y: c.y });
    }
    for (const n of cuePathCurveNodes) {
      if (isValidCueCurveKey(n.segmentKey, pathPoints)) m.set(n.segmentKey, { x: n.x, y: n.y });
    }
    return m;
  }, [cueDisplayCurveControls, cuePathCurveNodes, pathPoints]);

  const objectCurveByKey = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const c of objectDisplayCurveControls) {
      if (isValidObjectCurveKey(c.key, objectPathPoints)) m.set(c.key, { x: c.x, y: c.y });
    }
    for (const n of objectPathCurveNodes) {
      if (isValidObjectCurveKey(n.segmentKey, objectPathPoints)) {
        m.set(n.segmentKey, { x: n.x, y: n.y });
      }
    }
    return m;
  }, [objectDisplayCurveControls, objectPathCurveNodes, objectPathPoints]);

  /** 히트 테스트·핸들 — 병합 결과(노드가 display를 덮음) */
  const mergedCueCurveControlsForHit = useMemo((): PathSegmentCurveControl[] => {
    return [...cueCurveByKey.entries()].map(([key, { x, y }]) => ({ key, x, y }));
  }, [cueCurveByKey]);

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

  const effectiveSecondObjectActiveId = useMemo(() => {
    if (secondObjectPathPoints.length === 0) return null;
    return secondObjectActiveSpotOverrideId ?? secondObjectPathPoints[secondObjectPathPoints.length - 1]!.id;
  }, [secondObjectPathPoints, secondObjectActiveSpotOverrideId]);

  /** 활성 스팟이 공/쿠션에 닿으면 테두리 검정 — 다음 스팟 추가 가능 상태와 맞춤 */
  const activePathSpotRingStroke = (
    isActive: boolean,
    isDraggingThis: boolean,
    spotType: NanguPathPoint["type"]
  ) => {
    const onSurface = spotType === "ball" || spotType === "cushion";
    if (isDraggingThis) return onSurface ? "#000000" : "rgba(255,255,255,0.95)";
    if (isActive) return onSurface ? "#000000" : "rgba(255,255,255,0.55)";
    return "none";
  };

  /** 2목 스팟/충돌 시각화를 위해 2목 키 노출 */
  const resolvedSecondObjectBallKeyForDisplay = resolvedSecondObjectBallKey;

  /** 수구 경로 곡선 노드만 표시/조작 — 1목·2목 경로에는 노드 미표시 */
  const activeCueCurveControlsForHit = useMemo(
    () => mergedCueCurveControlsForHit,
    [mergedCueCurveControlsForHit]
  );

  const fineTuneContextRef = useRef<{
    cueCurveByKey: Map<string, { x: number; y: number }>;
    objectCurveByKey: Map<string, { x: number; y: number }>;
    pathPoints: NanguPathPoint[];
    objectPathPoints: NanguPathPoint[];
    secondObjectPathPoints: NanguPathPoint[];
    onMoveCueDisplayCurve?: typeof onMoveCueDisplayCurve;
    onMoveObjectDisplayCurve?: typeof onMoveObjectDisplayCurve;
    onMovePoint?: typeof onMovePoint;
    onMoveObjectPoint?: typeof onMoveObjectPoint;
    onMoveSecondObjectPoint?: typeof onMoveObjectPoint;
  }>(null!);
  fineTuneContextRef.current = {
    cueCurveByKey,
    objectCurveByKey,
    pathPoints,
    objectPathPoints,
    secondObjectPathPoints,
    onMoveCueDisplayCurve,
    onMoveObjectDisplayCurve,
    onMovePoint,
    onMoveObjectPoint,
    onMoveSecondObjectPoint,
  };

  const pathFineTuneStep = useCallback((dx: number, dy: number) => {
    const t = pathFineTuneTargetRef.current;
    if (!t) return;
    const ctx = fineTuneContextRef.current;
    if (t.kind === "curve") {
      if (t.curveKind !== "cue") return;
      const m = ctx.cueCurveByKey;
      const cur = m.get(t.key);
      if (!cur) return;
      const next = clampCurveControlNormPath({ x: cur.x + dx, y: cur.y + dy });
      ctx.onMoveCueDisplayCurve?.(t.key, next);
    } else {
      const pts =
        t.spotKind === "cue"
          ? ctx.pathPoints
          : t.spotKind === "object"
            ? ctx.objectPathPoints
            : ctx.secondObjectPathPoints;
      const p = pts.find((x) => x.id === t.id);
      if (!p) return;
      const next = { x: p.x + dx, y: p.y + dy };
      if (t.spotKind === "cue") ctx.onMovePoint?.(t.id, next);
      else if (t.spotKind === "object") ctx.onMoveObjectPoint?.(t.id, next);
      else ctx.onMoveSecondObjectPoint?.(t.id, next);
    }
  }, []);

  useEffect(() => {
    pathFineTuneMoveRef.current = pathFineTuneStep;
  }, [pathFineTuneStep]);

  const clearPathFineTuneTimers = useCallback(() => {
    if (pathFineTuneDelayRef.current) {
      clearTimeout(pathFineTuneDelayRef.current);
      pathFineTuneDelayRef.current = null;
    }
    if (pathFineTuneIntervalRef.current) {
      clearInterval(pathFineTuneIntervalRef.current);
      pathFineTuneIntervalRef.current = null;
    }
    pathFineTuneDirectionRef.current = null;
  }, []);

  const startPathFineTune = useCallback(
    (dx: number, dy: number) => {
      pathFineTuneStep(dx, dy);
      pathFineTunePressStartRef.current = Date.now();
      pathFineTuneLastMoveRef.current = pathFineTunePressStartRef.current;
      pathFineTuneDirectionRef.current = { dx, dy };
      clearPathFineTuneTimers();
      pathFineTuneDelayRef.current = setTimeout(() => {
        pathFineTuneDelayRef.current = null;
        const move = () => {
          const dir = pathFineTuneDirectionRef.current;
          if (!dir) return;
          const elapsed = Date.now() - pathFineTunePressStartRef.current;
          if (elapsed < 250) return;
          const intervalMs = elapsed < 500 ? 80 : elapsed < 1500 ? 40 : 20;
          if (Date.now() - pathFineTuneLastMoveRef.current >= intervalMs) {
            pathFineTuneLastMoveRef.current = Date.now();
            pathFineTuneMoveRef.current(dir.dx, dir.dy);
          }
        };
        pathFineTuneIntervalRef.current = setInterval(move, 20);
      }, 250);
    },
    [pathFineTuneStep, clearPathFineTuneTimers]
  );

  const handlePathFineTuneEnd = useCallback(() => {
    clearPathFineTuneTimers();
  }, [clearPathFineTuneTimers]);

  const clampPathFineTuneMagOffset = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const boxW = SPOT_MAGNIFIER_BOX_PX + 4;
    const totalH = SPOT_MAGNIFIER_BOX_PX + 4;
    const maxX = Math.max(margin, vw * 0.48 - boxW / 2);
    const maxY = Math.max(margin, vh * 0.48 - totalH / 2);
    // Remove vertical movement restriction
    return {
      x: Math.round(Math.max(-maxX, Math.min(maxX, x))),
      y: Math.round(Math.max(-maxY, Math.min(maxY, y))),
    };
  }, []);

  const handlePathFineTuneMagDragPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const o = pathFineTuneMagOffsetRef.current;
    pathFineTuneMagDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: o.x,
      origY: o.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePathFineTuneMagDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = pathFineTuneMagDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const nx = d.origX + (e.clientX - d.startX);
      const ny = d.origY + (e.clientY - d.startY);
      setPathFineTuneMagOffset(clampPathFineTuneMagOffset(nx, ny));
    },
    [clampPathFineTuneMagOffset]
  );

  const handlePathFineTuneMagDragPointerUp = useCallback((e: React.PointerEvent) => {
    const d = pathFineTuneMagDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    pathFineTuneMagDragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!pathFineTuneTarget) {
      setPathFineTuneMagOffset({ x: 0, y: 0 });
      setPathFineTuneFixedCenterNorm(null);
    } else {
      // Capture the initial position to fix the magnifier center
      let initialNorm: {x: number, y: number} | null = null;
      if (pathFineTuneTarget.kind === "curve") {
        if (pathFineTuneTarget.curveKind === "cue") {
          const c = cueCurveByKey.get(pathFineTuneTarget.key);
          if (c) initialNorm = { x: c.x, y: c.y };
        }
      } else if (pathFineTuneTarget.spotKind === "cue") {
        const idx = pathPoints.findIndex((p) => p.id === pathFineTuneTarget.id);
        if (idx >= 0) {
          const n = cueSpotDisplayNorms[idx];
          if (n) initialNorm = {x: n.x, y: n.y};
        }
      } else if (pathFineTuneTarget.spotKind === "object") {
        const idx = objectPathPoints.findIndex((p) => p.id === pathFineTuneTarget.id);
        if (idx >= 0) {
          const n = objectSpotDisplayNorms[idx];
          if (n) initialNorm = {x: n.x, y: n.y};
        }
      } else {
        const idx = secondObjectPathPoints.findIndex((p) => p.id === pathFineTuneTarget.id);
        if (idx >= 0) {
          const n = secondObjectSpotDisplayNorms[idx];
          if (n) initialNorm = {x: n.x, y: n.y};
        }
      }
      setPathFineTuneFixedCenterNorm(initialNorm);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathFineTuneTarget]);
  // The dependencies above will update the fixed center if points change, which we don't want while moving.
  // Actually we only want to set it ONCE when pathFineTuneTarget is first set,
  // NOT when pathPoints change. So dependencies should strictly be [pathFineTuneTarget].

  useEffect(() => {
    if (!pathFineTuneTarget) return;
    if (!pathMode && !objectPathMode && !secondObjectPathMode) {
      clearPathFineTuneTimers();
      setPathFineTuneTarget(null);
      setPathFineTuneMagnifier(false);
    }
  }, [pathMode, objectPathMode, secondObjectPathMode, pathFineTuneTarget, clearPathFineTuneTimers]);

  // Instead of recalculating, use the initially captured fixed center for the magnifier.
  // This ensures the spot moves within the view, instead of the view following the spot.
  const pathFineTuneMagnifierCenter = useMemo(() => {
    if (!pathFineTuneTarget || !pathFineTuneMagnifier || !pathFineTuneFixedCenterNorm) return null;
    return toPx(pathFineTuneFixedCenterNorm.x, pathFineTuneFixedCenterNorm.y);
  }, [pathFineTuneTarget, pathFineTuneMagnifier, pathFineTuneFixedCenterNorm, toPx]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (pathFineTuneTarget) {
        const el = e.target as HTMLElement;
        if (!el.closest("[data-path-fine-tune]")) {
          clearPathFineTuneTimers();
          setPathFineTuneTarget(null);
          setPathFineTuneMagnifier(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      const aim = resolvePointerAimFromClient(e.clientX, e.clientY);
      if (!aim) return;
      const now = Date.now();
      const markPathAppendForZoomDupGuard = () => {
        onPathAppendPointerDown?.(e.pointerId);
      };

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
              if (isCueBallKey(key)) {
                if (pathPlaybackActive && allowCuePlaybackGestures && onCueBallSingleTap && pathPoints.length >= 1) {
                  onCueBallSingleTap();
                  e.stopPropagation();
                  e.preventDefault();
                  return;
                }
                if ((pathMode || objectPathMode) && onPathEditCueBallTap) {
                  onPathEditCueBallTap();
                  e.stopPropagation();
                  e.preventDefault();
                  return;
                }
                onZoomSetFocusCanvasPx(px, py);
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              if ((pathMode || objectPathMode) && onPathEditObjectBallTap) {
                if (
                  canActivatePathEditForObjectBallTap({
                    hitBallKey: key,
                    pathEditFirstObjectBallKey,
                    objectPathPointsLength: objectPathPoints.length,
                    cuePathPointsLength: pathPoints.length,
                  })
                ) {
                  onPathEditObjectBallTap();
                  e.stopPropagation();
                  e.preventDefault();
                  return;
                }
                onZoomSetFocusCanvasPx(px, py);
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              if (secondObjectPathMode && secondObjectPathCollisionNormForUi && onAddSecondObjectPathAim) {
                markPathAppendForZoomDupGuard();
                onAddSecondObjectPathAim(aim);
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              if (objectPathMode && objectPathCollisionNormForUi && onAddObjectPathAim) {
                markPathAppendForZoomDupGuard();
                onAddObjectPathAim(aim);
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              if (pathMode && onAddCuePathAim) {
                markPathAppendForZoomDupGuard();
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
        if (secondObjectPathMode && secondObjectPathCollisionNormForUi && onAddSecondObjectPathAim) {
          markPathAppendForZoomDupGuard();
          onAddSecondObjectPathAim(aim);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (objectPathMode && objectPathCollisionNormForUi && onAddObjectPathAim) {
          markPathAppendForZoomDupGuard();
          onAddObjectPathAim(aim);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (pathMode && onAddCuePathAim) {
          markPathAppendForZoomDupGuard();
          onAddCuePathAim(aim);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        return;
      }

      const norm = aim.norm;

      /** 곡선 노드(드래그·더블탭 삭제·3초 롱프레스 미세조정) — 활성 경로 레이어만 */
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
              if (tRef.current?.key !== k) return;
              const cap = curvePointerCaptureRef.current;
              if (cap) {
                try {
                  cap.el.releasePointerCapture(cap.pointerId);
                } catch {
                  /* ignore */
                }
                curvePointerCaptureRef.current = null;
              }
              tRef.current = null;
              setDraggingCurve(null);
              setPathFineTuneTarget({ kind: "curve", curveKind: kind, key: k });
            }, PATH_FINE_TUNE_LONG_PRESS_MS);
            curveLongPressRef.current = {
              kind,
              key: k,
              timer,
              startClientX: e.clientX,
              startClientY: e.clientY,
            };
            setDraggingCurve({ kind, key: k });
            try {
              const el = e.currentTarget as HTMLElement;
              el.setPointerCapture(e.pointerId);
              curvePointerCaptureRef.current = { el, pointerId: e.pointerId };
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
            activeCueCurveControlsForHit,
            (key) => isValidCueCurveKey(key, pathPoints),
            onRemoveCueDisplayCurve
          );
          if (stopped) return;
        }
      }

      const c = classifySolutionPathPointerHit({
        norm,
        pathMode,
        objectPathMode,
        secondObjectPathMode,
        cuePos,
        pathPoints,
        objectPathPoints,
        secondObjectPathPoints,
        objectBallNorm,
        ballPickLayout,
        collisionLayout: tableBallPlacement ?? ballPickLayout ?? null,
        ballNormOverrides,
        width: DEFAULT_TABLE_WIDTH,
        height: DEFAULT_TABLE_HEIGHT,
        allowCuePlaybackGestures: Boolean(allowCuePlaybackGestures),
        pathPlaybackActive: Boolean(pathPlaybackActive),
        objectPathCollisionNormOverride:
          objectPathCollisionNormForUi != null ? objectPathCollisionNormForUi : undefined,
        secondObjectPathCollisionNormOverride:
          secondObjectPathCollisionNormForUi != null ? secondObjectPathCollisionNormForUi : undefined,
        pathEditFirstObjectBallKey,
        objectBallTapSwitchesCueToObjectLayer,
      });

      if (c.kind === "inactive") return;

      const cueGestureLayout = ballPickLayout ?? tableBallPlacement ?? null;

      if (c.kind === "cueBallPlayback" && onCueBallSingleTap) {
        onCueBallSingleTap();
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (
        (pathMode || objectPathMode) &&
        onPathEditCueBallTap &&
        cueGestureLayout &&
        c.kind === "ball"
      ) {
        const ck = cueGestureLayout.cueBall === "yellow" ? "yellow" : ("white" as const);
        const cn =
          ballNormOverrides?.[ck] ??
          (ck === "yellow" ? cueGestureLayout.yellowBall : cueGestureLayout.whiteBall);
        const tapR = getSolutionPathBallTapRadiusPx(collisionRect);
        if (distanceNormPointsInPlayfieldPx(norm, cn, collisionRect) <= tapR) {
          onPathEditCueBallTap();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }

      if (c.kind === "cueBallContactAppend") {
        markPathAppendForZoomDupGuard();
        if (onAddCuePathAim) onAddCuePathAim(aim);
        else onAddPoint?.(norm);
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
        const last = lastClickRef.current;
        if (last?.kind === "obj" && last?.id === p.id && now - last.t < 400) {
          lastClickRef.current = null;
          onPathEditObjectBallTap?.();
          if (p.id !== effectiveObjectActiveId) {
            onObjectActiveSpotChange?.(p.id);
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        lastClickRef.current = { id: p.id, t: now, kind: "obj" };
        onObjectActiveSpotChange?.(p.id);
        {
          const { px, py } = toPx(p.x, p.y);
          onZoomSetFocusCanvasPx?.(px, py);
        }
        if (p.id === effectiveObjectActiveId) {
          onPathSpotDragStart?.("object", p.id);
          draggingObjectIdRef.current = p.id;
          setDraggingObjectId(p.id);
          beginActiveSpotDrag(e, norm, { x: p.x, y: p.y }, {
            spotKind: "object",
            spotId: p.id,
          });
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "objectSegment") {
        const key = `obj-${c.segmentIndex}`;
        const lastS = segmentDblRef.current;
        if (lastS?.key === key && now - lastS.t < 400) {
          segmentDblRef.current = null;
          /** 경로선 더블탭으로 스팟 생성 금지 */
        } else {
          segmentDblRef.current = { key, t: now };
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "objectBallMarkingTap") {
        markPathAppendForZoomDupGuard();
        if (secondObjectPathMode) {
          if (onAddSecondObjectPathAim) onAddSecondObjectPathAim(aim);
          else onAddSecondObjectPoint?.(norm);
        } else if (objectPathMode) {
          if (onAddObjectPathAim) onAddObjectPathAim(aim);
          else onAddObjectPoint?.(norm);
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "pathSecondObjectBallTap") {
        // 2목 클릭 시 2목 레이어로 전환 시도 (구현 필요 시 onPathEditSecondObjectBallTap 등 사용)
        // 하단 활성(수구/1목적구/2목적구) 버튼이 주력 — 우선은 줌 포커스만 처리하거나 레이어 전환 유도
        onZoomSetFocusCanvasPx?.(toPx(norm.x, norm.y).px, toPx(norm.x, norm.y).py);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "secondObjectSegment") {
        const key = `obj2-${c.segmentIndex}`;
        const lastS = segmentDblRef.current;
        if (lastS?.key === key && now - lastS.t < 400) {
          segmentDblRef.current = null;
        } else {
          segmentDblRef.current = { key, t: now };
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "secondObjectSpot") {
        const p = secondObjectPathPoints.find((x) => x.id === c.id);
        if (!p) return;
        const last = lastClickRef.current;
        if (last?.kind === "obj2" && last?.id === p.id && now - last.t < 400) {
          lastClickRef.current = null;
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        lastClickRef.current = { id: p.id, t: now, kind: "obj2" };
        onSecondObjectActiveSpotChange?.(p.id);
        {
          const { px, py } = toPx(p.x, p.y);
          onZoomSetFocusCanvasPx?.(px, py);
        }
        if (p.id === effectiveSecondObjectActiveId) {
          onPathSpotDragStart?.("object2", p.id);
          draggingSecondObjectIdRef.current = p.id;
          setDraggingSecondObjectId(p.id);
          beginActiveSpotDrag(e, norm, { x: p.x, y: p.y }, {
            spotKind: "object2",
            spotId: p.id,
          });
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "emptyObject") {
        markPathAppendForZoomDupGuard();
        if (onAddObjectPathAim) onAddObjectPathAim(aim);
        else onAddObjectPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "emptyObject2") {
        markPathAppendForZoomDupGuard();
        if (onAddSecondObjectPathAim) onAddSecondObjectPathAim(aim);
        else onAddSecondObjectPoint?.(norm);
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
          onPathEditCueBallTap?.();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        lastClickRef.current = { id: p.id, t: now, kind: "cue" };
        onCueActiveSpotChange?.(p.id);
        {
          const { px, py } = toPx(p.x, p.y);
          onZoomSetFocusCanvasPx?.(px, py);
        }
        if (p.id === effectiveCueActiveId) {
          onPathSpotDragStart?.("cue", p.id);
          draggingIdRef.current = p.id;
          setDraggingId(p.id);
          beginActiveSpotDrag(e, norm, { x: p.x, y: p.y }, {
            spotKind: "cue",
            spotId: p.id,
          });
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "cueSegment") {
        if (troubleCurveEditMode && pathMode && !objectPathMode) {
          const tkey = `curve-cue-${c.segmentIndex}`;
          const lastC = curveSegmentDblRef.current;
          if (lastC?.key === tkey && now - lastC.t < 420) {
            curveSegmentDblRef.current = null;
            const sk = cueSegmentCurveKey(pathPoints, c.segmentIndex);
            if (sk && !cueCurveByKey.has(sk)) onUpsertCueDisplayCurve?.(sk, norm);
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
          /** 경로선 더블탭으로 스팟 생성 금지 */
        } else {
          segmentDblRef.current = { key, t: now };
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "emptyCue" || c.kind === "pathObjectBallTap") {
        if (c.kind === "pathObjectBallTap" && onPathEditObjectBallTap) {
          onPathEditObjectBallTap();
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        /** 마지막이 쿠션(스팟점)이면 플레이필드 어디를 탭해도 스냅 기준으로 다음 스팟 연결 — 반직선 실패 없이 */
        const lastCue = pathPoints[pathPoints.length - 1];
        if (lastCue?.type === "cushion") {
          const n = resolveLandscapeNormFromClient(e.clientX, e.clientY);
          if (n) {
            markPathAppendForZoomDupGuard();
            onAddPoint?.(n);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        markPathAppendForZoomDupGuard();
        if (onAddCuePathAim) onAddCuePathAim(aim);
        else onAddPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [
      pathMode,
      objectPathMode,
      secondObjectPathMode,
      resolvePointerAimFromClient,
      resolveLandscapeNormFromClient,
      pathPoints,
      objectPathPoints,
      secondObjectPathPoints,
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
      onAddSecondObjectPoint,
      onAddSecondObjectPathAim,
      onRemoveSecondObjectPoint,
      onPathSpotDragStart,
      onInsertObjectBetween,
      onInsertObjectPathAim,
      onInsertSecondObjectBetween,
      onInsertSecondObjectPathAim,
      ballPickLayout,
      ballNormOverrides,
      onZoomSetFocusCanvasPx,
      toPx,
      collisionRect,
      objectPathCollisionNormForUi,
      placementForFirstObject,
      allowCuePlaybackGestures,
      pathPlaybackActive,
      onCueBallSingleTap,
      onPathEditCueBallTap,
      onPathEditObjectBallTap,
      pathEditFirstObjectBallKey,
      objectBallTapSwitchesCueToObjectLayer,
      effectiveCueActiveId,
      effectiveObjectActiveId,
      effectiveSecondObjectActiveId,
      onCueActiveSpotChange,
      onObjectActiveSpotChange,
      onSecondObjectActiveSpotChange,
      curveHandleInteraction,
      pathLinesVisible,
      secondObjectPathLinesVisible,
      mergedCueCurveControlsForHit,
      activeCueCurveControlsForHit,
      cueCurveByKey,
      objectCurveByKey,
      troubleCurveEditMode,
      onRemoveCueDisplayCurve,
      onUpsertCueDisplayCurve,
      onCurveHandleDragBegin,
      beginActiveSpotDrag,
      onPathAppendPointerDown,
      pathFineTuneTarget,
      clearPathFineTuneTimers,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingCurve) {
        const norm = resolveLandscapeNormFromClient(e.clientX, e.clientY);
        if (norm && draggingCurve.kind === "cue") {
          onMoveCueDisplayCurve?.(draggingCurve.key, norm);
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

      const applySpotDragPrecision = (
        onMove: (id: string, n: { x: number; y: number }) => void,
        id: string,
        kind: "cue" | "object" | "object2"
      ) => {
        const slop = spotPrecisionSlopRef.current;
        if (slop) {
          const dx = e.clientX - slop.clientX;
          const dy = e.clientY - slop.clientY;
          if (Math.hypot(dx, dy) > SPOT_PRECISION_MOVE_SLOP_PX) {
            if (spotPrecisionTimerRef.current != null) {
              window.clearTimeout(spotPrecisionTimerRef.current);
              spotPrecisionTimerRef.current = null;
              spotPrecisionSlopRef.current = null;
            }
            if (spotFineTuneTimerRef.current != null) {
              window.clearTimeout(spotFineTuneTimerRef.current);
              spotFineTuneTimerRef.current = null;
            }
          }
        }
        const pn = spotDragPointerNormRef.current;
        const sn = spotDragSpotNormRef.current;
        let targetNorm = norm;
        if (pn && sn) {
          const factor = spotPrecisionActiveRef.current ? SPOT_PRECISION_DELTA_FACTOR : 1;
          const dxi = norm.x - pn.x;
          const dyi = norm.y - pn.y;
          spotDragPointerNormRef.current = { x: norm.x, y: norm.y };
          targetNorm = {
            x: sn.x + dxi * factor,
            y: sn.y + dyi * factor,
          };
          spotDragSpotNormRef.current = targetNorm;
        }
        onMove(id, targetNorm);
      };

      if (draggingObjectId && onMoveObjectPoint) {
        applySpotDragPrecision(onMoveObjectPoint, draggingObjectId, "object");
        e.preventDefault();
        return;
      }
      if (draggingSecondObjectId && onMoveSecondObjectPoint) {
        applySpotDragPrecision(onMoveSecondObjectPoint, draggingSecondObjectId, "object2");
        e.preventDefault();
        return;
      }
      if (draggingId && onMovePoint) {
        applySpotDragPrecision(onMovePoint, draggingId, "cue");
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
      pathPoints,
      objectPathPoints,
      onMoveCueDisplayCurve,
      toPx,
    ]
  );

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent) => {
      const lp = curveLongPressRef.current;
      if (lp?.timer) window.clearTimeout(lp.timer);
      curveLongPressRef.current = null;
      const cr = curvePointerCaptureRef.current;
      if (cr && (!e || e.pointerId === cr.pointerId)) {
        try {
          cr.el.releasePointerCapture(cr.pointerId);
        } catch {
          /* ignore */
        }
        curvePointerCaptureRef.current = null;
      }
      setDraggingCurve(null);
      const wasSpotDrag = draggingId != null || draggingObjectId != null;
      const wasSecondSpotDrag = draggingSecondObjectId != null;
      if (e?.currentTarget && spotPointerCaptureIdRef.current === e.pointerId) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        spotPointerCaptureIdRef.current = null;
        spotDragCaptureRef.current = null;
      } else if (spotPointerCaptureIdRef.current != null && e == null) {
        spotPointerCaptureIdRef.current = null;
        spotDragCaptureRef.current = null;
      }
      draggingIdRef.current = null;
      draggingObjectIdRef.current = null;
      draggingSecondObjectIdRef.current = null;
      setDraggingId(null);
      setDraggingObjectId(null);
      setDraggingSecondObjectId(null);
      if (wasSpotDrag || wasSecondSpotDrag) {
        clearSpotDragGestureState();
        onPathSpotDragEnd?.();
      }
    },
    [draggingId, draggingObjectId, draggingSecondObjectId, onPathSpotDragEnd, clearSpotDragGestureState]
  );

  const interactive = pathMode || objectPathMode || secondObjectPathMode || Boolean(allowCuePlaybackGestures);

  const pathFineTunePortal =
    pathFineTuneTarget && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[10060] flex items-center justify-center pointer-events-none"
              aria-label="경로 미세조정"
            >
              <div
                className="pointer-events-auto flex max-h-[min(100dvh,100vh)] flex-col items-center gap-4 rounded-2xl bg-transparent p-3 shadow-none"
                data-path-fine-tune=""
              >
                <div className="grid grid-cols-3 shrink-0 gap-3 items-center justify-center w-max">
                  <span className={FT_SPACER_CLASS} aria-hidden />
                  <button
                    type="button"
                    aria-label="위로 미세 이동"
                    className={FT_BTN_CLASS}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      startPathFineTune(
                        orientation === "landscape" ? 0 : -FINE_GRID_STEP_SHORT,
                        orientation === "landscape" ? -FINE_GRID_STEP_SHORT : 0
                      );
                    }}
                    onPointerUp={handlePathFineTuneEnd}
                    onPointerLeave={handlePathFineTuneEnd}
                    onPointerCancel={handlePathFineTuneEnd}
                    onContextMenu={(ev) => ev.preventDefault()}
                  >
                    ▲
                  </button>
                  <span className={FT_SPACER_CLASS} aria-hidden />
                  <button
                    type="button"
                    aria-label="왼쪽으로 미세 이동"
                    className={FT_BTN_CLASS}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      startPathFineTune(
                        orientation === "landscape" ? -FINE_GRID_STEP_LONG : 0,
                        orientation === "landscape" ? 0 : FINE_GRID_STEP_LONG
                      );
                    }}
                    onPointerUp={handlePathFineTuneEnd}
                    onPointerLeave={handlePathFineTuneEnd}
                    onPointerCancel={handlePathFineTuneEnd}
                    onContextMenu={(ev) => ev.preventDefault()}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    aria-label={pathFineTuneMagnifier ? "돋보기 끄기" : "돋보기 켜기"}
                    aria-pressed={pathFineTuneMagnifier}
                    className={`${FT_BTN_CLASS} ${pathFineTuneMagnifier ? "ring-2 ring-white/80" : ""}`}
                    onClick={() => setPathFineTuneMagnifier((v) => !v)}
                  >
                    <Search className="mx-auto h-6 w-6" strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="오른쪽으로 미세 이동"
                    className={FT_BTN_CLASS}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      startPathFineTune(
                        orientation === "landscape" ? FINE_GRID_STEP_LONG : 0,
                        orientation === "landscape" ? 0 : -FINE_GRID_STEP_LONG
                      );
                    }}
                    onPointerUp={handlePathFineTuneEnd}
                    onPointerLeave={handlePathFineTuneEnd}
                    onPointerCancel={handlePathFineTuneEnd}
                    onContextMenu={(ev) => ev.preventDefault()}
                  >
                    ▶
                  </button>
                  <span className={FT_SPACER_CLASS} aria-hidden />
                  <button
                    type="button"
                    aria-label="아래로 미세 이동"
                    className={FT_BTN_CLASS}
                    onPointerDown={(ev) => {
                      ev.preventDefault();
                      startPathFineTune(
                        orientation === "landscape" ? 0 : FINE_GRID_STEP_SHORT,
                        orientation === "landscape" ? FINE_GRID_STEP_SHORT : 0
                      );
                    }}
                    onPointerUp={handlePathFineTuneEnd}
                    onPointerLeave={handlePathFineTuneEnd}
                    onPointerCancel={handlePathFineTuneEnd}
                    onContextMenu={(ev) => ev.preventDefault()}
                  >
                    ▼
                  </button>
                  <span className={FT_SPACER_CLASS} aria-hidden />
                </div>
                {pathFineTuneMagnifier && pathFineTuneMagnifierCenter && pathLinesVisible ? (
              <div
                className="shrink-0 cursor-grab touch-none select-none rounded-xl border-2 border-white/85 bg-slate-950/95 shadow-2xl active:cursor-grabbing"
                style={{
                  transform: `translate(${pathFineTuneMagOffset.x}px, ${pathFineTuneMagOffset.y}px)`,
                  width: SPOT_MAGNIFIER_BOX_PX,
                  height: SPOT_MAGNIFIER_BOX_PX,
                }}
                onPointerDown={handlePathFineTuneMagDragPointerDown}
                onPointerMove={handlePathFineTuneMagDragPointerMove}
                onPointerUp={handlePathFineTuneMagDragPointerUp}
                onPointerCancel={handlePathFineTuneMagDragPointerUp}
                aria-label="확대창 위치 이동"
              >
                <div className="relative h-full w-full overflow-hidden pointer-events-none" aria-hidden>
                <svg
                  width={SPOT_MAGNIFIER_BOX_PX}
                  height={SPOT_MAGNIFIER_BOX_PX}
                  viewBox={`${pathFineTuneMagnifierCenter.px - SPOT_MAGNIFIER_VIEW_RADIUS_PX} ${pathFineTuneMagnifierCenter.py - SPOT_MAGNIFIER_VIEW_RADIUS_PX} ${SPOT_MAGNIFIER_VIEW_RADIUS_PX * 2} ${SPOT_MAGNIFIER_VIEW_RADIUS_PX * 2}`}
                  className="block"
                >
                  <rect
                    x={0}
                    y={0}
                    width={canvasW}
                    height={canvasH}
                    fill={isWireframeMagnifier ? "#dbeafe" : "#2563eb"}
                  />
                  <rect
                    x={drawRect.left}
                    y={drawRect.top}
                    width={drawRect.width}
                    height={drawRect.height}
                    rx={Math.max(2, ballR * 0.55)}
                    ry={Math.max(2, ballR * 0.55)}
                    fill={isWireframeMagnifier ? "#bae6fd" : "#7dd3fc"}
                    stroke={isWireframeMagnifier ? "#000000" : "rgba(0,0,0,0.22)"}
                    strokeWidth={isWireframeMagnifier ? 1 : 1}
                  />
                  {magnifierPlacement &&
                    (["red", "yellow", "white"] as const).map((key) => {
                      const base =
                        key === "red"
                          ? magnifierPlacement.redBall
                          : key === "yellow"
                            ? magnifierPlacement.yellowBall
                            : magnifierPlacement.whiteBall;
                      const norm = ballNormOverrides?.[key] ?? base;
                      const { px, py } = toPx(norm.x, norm.y);
                      const fill =
                        key === "red" ? "#ef4444" : key === "yellow" ? "#facc15" : "#f8fafc";
                      const cueKey = magnifierPlacement.cueBall === "yellow" ? "yellow" : "white";
                      const isCue = key === cueKey;
                      return (
                        <circle
                          key={`ft-mag-ball-${key}`}
                          cx={px}
                          cy={py}
                          r={ballR}
                          fill={fill}
                          stroke={isCue ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.35)"}
                          strokeWidth={isCue ? 1.7 : 1}
                        />
                      );
                    })}
                  {cueSegmentRender.map((seg) =>
                    seg.mode === "line" ? (
                      <line
                        key={`ft-mag-cue-${seg.i}`}
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
                        key={`ft-mag-cue-${seg.i}`}
                        d={`M ${seg.x1} ${seg.y1} Q ${seg.cx} ${seg.cy} ${seg.x2} ${seg.y2}`}
                        fill="none"
                        stroke={CUE_PATH_STROKE}
                        strokeWidth={LINE_WIDTH}
                        strokeLinecap="round"
                      />
                    )
                  )}
                  {objectSegmentRender.map((seg) =>
                    seg.mode === "line" ? (
                      <line
                        key={`ft-mag-obj-${seg.i}`}
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
                        key={`ft-mag-obj-${seg.i}`}
                        d={`M ${seg.x1} ${seg.y1} Q ${seg.cx} ${seg.cy} ${seg.x2} ${seg.y2}`}
                        fill="none"
                        stroke={OBJECT_PATH_STROKE}
                        strokeWidth={LINE_WIDTH}
                        strokeLinecap="round"
                      />
                    )
                  )}
                  {secondObjectPxSegs.map((seg, i) => (
                    <line
                      key={`ft-mag-obj2-${i}`}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke={SECOND_OBJECT_PATH_STROKE}
                      strokeWidth={LINE_WIDTH}
                      strokeLinecap="round"
                    />
                  ))}
                  {pathPoints.map((p, i) => {
                    const n = cueSpotDisplayNorms[i]!;
                    const { px, py } = toPx(n.x, n.y);
                    const isDraggingThis = draggingId === p.id;
                    const isActive = pathMode && p.id === effectiveCueActiveId;
                    const strokeW = isDraggingThis ? 3 : isActive ? 2 : 0;
                    const sr = Math.max(0, ballR - strokeW / 2);
                    return (
                      <circle
                        key={`ft-mag-cspot-${p.id}`}
                        cx={px}
                        cy={py}
                        r={sr}
                        fill={SPOT_FILL}
                        fillOpacity={SPOT_FILL_OPACITY}
                        stroke={activePathSpotRingStroke(isActive, isDraggingThis, p.type)}
                        strokeWidth={strokeW}
                      />
                    );
                  })}
                  {objectPathPoints.map((p, i) => {
                    const n = objectSpotDisplayNorms[i]!;
                    const { px, py } = toPx(n.x, n.y);
                    const isDraggingThis = draggingObjectId === p.id;
                    const isActive = objectPathMode && p.id === effectiveObjectActiveId;
                    const strokeW = isDraggingThis ? 3 : isActive ? 2 : 0;
                    const sr = Math.max(0, ballR - strokeW / 2);
                    return (
                      <circle
                        key={`ft-mag-ospot-${p.id}`}
                        cx={px}
                        cy={py}
                        r={sr}
                        fill={OBJECT_SPOT_FILL}
                        fillOpacity={OBJECT_SPOT_FILL_OPACITY}
                        stroke={activePathSpotRingStroke(isActive, isDraggingThis, p.type)}
                        strokeWidth={strokeW}
                      />
                    );
                  })}
                  {secondObjectPathPoints.map((p, i) => {
                    const n = secondObjectSpotDisplayNorms[i]!;
                    const { px, py } = toPx(n.x, n.y);
                    const isDraggingThis = draggingSecondObjectId === p.id;
                    const isActive = secondObjectPathMode && p.id === effectiveSecondObjectActiveId;
                    const strokeW = isDraggingThis ? 3 : isActive ? 2 : 0;
                    const sr = Math.max(0, ballR - strokeW / 2);
                    return (
                      <circle
                        key={`ft-mag-obj2spot-${p.id}`}
                        cx={px}
                        cy={py}
                        r={sr}
                        fill={SECOND_OBJECT_SPOT_FILL}
                        fillOpacity={SECOND_OBJECT_SPOT_FILL_OPACITY}
                        stroke={activePathSpotRingStroke(isActive, isDraggingThis, p.type)}
                        strokeWidth={strokeW}
                      >
                        {isActive ? (
                          <animate
                            attributeName="fillOpacity"
                            values={`${SECOND_OBJECT_SPOT_FILL_OPACITY};0`}
                            keyTimes="0;0.5"
                            dur={`${SPOT_BLINK_CYCLE_MS}ms`}
                            repeatCount="indefinite"
                            calcMode="discrete"
                          />
                        ) : null}
                      </circle>
                    );
                  })}
                </svg>
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-white/75" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-px w-5 -translate-x-1/2 -translate-y-1/2 bg-white/75" />
                </div>
              </div>
            ) : null}
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
    <div
      data-testid="nangu-solution-path-overlay"
      data-cue-path-segment-count={cuePxSegs.length}
      data-object-path-segment-count={objectPxSegs.length}
      data-object-path-points-len={objectPathPoints.length}
      data-first-object-ball-key={resolvedFirstObjectBallKey ?? "none"}
      data-second-object-ball-key={resolvedSecondObjectBallKey ?? "none"}
      data-object-path-start-ready={objectPathRenderStartNorm ? "1" : "0"}
      data-second-object-path-start-ready={secondObjectPathRenderStartNorm ? "1" : "0"}
      data-object-line-visible={
        objectPathLinesVisible && objectPxSegs.length > 0 ? "1" : "0"
      }
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => void handlePointerUp(e)}
      onPointerLeave={(e) => void handlePointerUp(e)}
      onPointerCancel={(e) => void handlePointerUp(e)}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        width={canvasW}
        height={canvasH}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        {/* 수구 경로 — 제어점 있으면 2차 베지어(표시 전용) */}
        {cuePathLinesVisible &&
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
        {objectPathLinesVisible &&
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
        {secondObjectPathLinesVisible &&
          secondObjectPxSegs.map((seg, i) => (
            <line
              key={`obj2-seg-${i}`}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={SECOND_OBJECT_PATH_STROKE}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
            />
          ))}
        {(curveHandleInteraction || curveHandlesShowSubtle) &&
          cuePathLinesVisible &&
          activeCueCurveControlsForHit.map((ctl) => {
            if (!isValidCueCurveKey(ctl.key, pathPoints)) return null;
            const { px, py } = toPx(ctl.x, ctl.y);
            const subtle = !curveHandleInteraction || !pathMode || objectPathMode;
            const r = subtle ? 3.5 : 6;
            return (
              <circle
                key={`cue-curve-ctl-${ctl.key}`}
                cx={px}
                cy={py}
                r={r}
                fill={subtle ? CURVE_HANDLE_FILL_SUBTLE : CURVE_HANDLE_FILL}
                stroke={CURVE_HANDLE_STROKE}
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
        {cuePathLinesVisible &&
          pathPoints.map((p, i) => {
          const n = cueSpotDisplayNorms[i]!;
          const { px, py } = toPx(n.x, n.y);
          const isDraggingThis = draggingId === p.id;
          const isActive = pathMode && p.id === effectiveCueActiveId;
          const strokeW = isDraggingThis ? 3 : isActive ? 2 : 0;
          /** 흰 라인(stroke) 포함 최종 외곽 반지름을 공 반지름(ballR)과 동일하게 유지 */
          const r = Math.max(0, ballR - strokeW / 2);
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r={r}
              fill={SPOT_FILL}
              fillOpacity={SPOT_FILL_OPACITY}
              stroke={activePathSpotRingStroke(isActive, isDraggingThis, p.type)}
              strokeWidth={strokeW}
            >
              {isActive ? (
                <animate
                  attributeName="fillOpacity"
                  values={`${SPOT_FILL_OPACITY};0`}
                  keyTimes="0;0.5"
                  dur={`${SPOT_BLINK_CYCLE_MS}ms`}
                  repeatCount="indefinite"
                  calcMode="discrete"
                />
              ) : null}
            </circle>
          );
        })}

        {/* 1목 경로 스팟 — 마지막 세그먼트 양끝만 깜빡임·드래그·삭제(수구 경로와 동일) */}
        {objectPathLinesVisible &&
          objectPathPoints.map((p, i) => {
          const n = objectSpotDisplayNorms[i]!;
          const { px, py } = toPx(n.x, n.y);
          const isDraggingThis = draggingObjectId === p.id;
          const isActive = objectPathMode && p.id === effectiveObjectActiveId;
          const strokeW = isDraggingThis ? 3 : isActive ? 2 : 0;
          /** 흰 라인(stroke) 포함 최종 외곽 반지름을 공 반지름(ballR)과 동일하게 유지 */
          const r = Math.max(0, ballR - strokeW / 2);
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r={r}
              fill={OBJECT_SPOT_FILL}
              fillOpacity={OBJECT_SPOT_FILL_OPACITY}
              stroke={activePathSpotRingStroke(isActive, isDraggingThis, p.type)}
              strokeWidth={strokeW}
            >
              {isActive ? (
                <animate
                  attributeName="fillOpacity"
                  values={`${OBJECT_SPOT_FILL_OPACITY};0`}
                  keyTimes="0;0.5"
                  dur={`${SPOT_BLINK_CYCLE_MS}ms`}
                  repeatCount="indefinite"
                  calcMode="discrete"
                />
              ) : null}
            </circle>
          );
        })}

        {/* 2목 경로 스팟 */}
        {secondObjectPathLinesVisible &&
          secondObjectPathPoints.map((p, i) => {
          const n = secondObjectSpotDisplayNorms[i]!;
          const { px, py } = toPx(n.x, n.y);
          const isDraggingThis = draggingSecondObjectId === p.id;
          const isActive = secondObjectPathMode && p.id === effectiveSecondObjectActiveId;
          const strokeW = isDraggingThis ? 3 : isActive ? 2 : 0;
          const r = Math.max(0, ballR - strokeW / 2);
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r={r}
              fill={SECOND_OBJECT_SPOT_FILL}
              fillOpacity={SECOND_OBJECT_SPOT_FILL_OPACITY}
              stroke={activePathSpotRingStroke(isActive, isDraggingThis, p.type)}
              strokeWidth={strokeW}
            >
              {isActive ? (
                <animate
                  attributeName="fillOpacity"
                  values={`${SECOND_OBJECT_SPOT_FILL_OPACITY};0`}
                  keyTimes="0;0.5"
                  dur={`${SPOT_BLINK_CYCLE_MS}ms`}
                  repeatCount="indefinite"
                  calcMode="discrete"
                />
              ) : null}
            </circle>
          );
        })}
      </svg>

    </div>
    {pathFineTunePortal}
    </>
  );
}
