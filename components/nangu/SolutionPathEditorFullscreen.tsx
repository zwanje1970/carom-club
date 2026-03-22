"use client";

/**
 * 경로(수구·1목) 편집 전용 전체화면 — 스팟/줌/재생은 여기서만 (미리보기는 보기 전용).
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { TableDrawStyle } from "@/components/billiard";
import { PathPlaybackViewOverlay } from "@/components/nangu/PathPlaybackViewOverlay";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import { NanguSolutionPathOverlay } from "@/components/nangu/NanguSolutionPathOverlay";
import {
  SolutionTableZoomShell,
  type SolutionTablePanPointerPolicy,
  type SolutionTableZoomShellApi,
} from "@/components/nangu/SolutionTableZoomShell";
import { useBallPlacementFullscreen } from "@/components/community/BallPlacementFullscreenContext";
import { useTableOrientation } from "@/hooks/useTableOrientation";
import type { SolutionTableZoomContextValue } from "@/components/nangu/solution-table-zoom-context";
import {
  getPlayfieldRect,
  pixelToNormalized,
  isInsidePlayfield,
  portraitToLandscapeNorm,
  distanceNormPointsInPlayfieldPx,
  playfieldGridOneCellEdgePx,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import { getNonCueBallNorms, type NanguBallPlacement, type NanguPathPoint } from "@/lib/nangu-types";
import {
  ballCircumferenceNormFacingApproach,
  cueFirstObjectHitFromBallPlacement,
} from "@/lib/solution-path-geometry";
import {
  appendCuePathPlayfieldWithAutoCushion,
  appendCuePathSpotWithAim,
  insertCuePathSpot,
  insertCuePathSpotWithAim,
  moveCuePathSpotById,
  cuePathAppendWouldDuplicateExistingSpot,
  snapCuePathTap,
  snapObjectPathPlayfieldTap,
  snapToPlayfieldCushionJunction,
  stripInvalidEndSpots,
  isLastSegmentEndpointSpotIndex,
  type CuePathRayAppendContext,
  type CuePathSnapFn,
  type PathPointerAim,
} from "@/lib/cue-path-cushion-rules";
import {
  resolveObjectPathRayHitLandscape,
  landscapeNormToPlayfieldCanvasPx,
  tableCanvasClampedToPlayfieldLandscapeNorm,
} from "@/lib/cue-path-ray-resolve";
import type { BallSpeed } from "@/lib/ball-speed-constants";
import { useSolutionPathPlayback } from "@/hooks/useSolutionPathPlayback";
import { TROUBLE_SOLUTION_CONSOLE } from "@/components/trouble/trouble-console-contract";
import { CollisionWarningToast } from "@/components/trouble/CollisionWarningToast";
import { sanitizeImageSrc } from "@/lib/image-src";
import {
  classifySolutionPathPointerHit,
  isClassificationEmptyForPan,
} from "@/lib/solution-path-pointer-classify";

/** nangu는 1목 경로 없음. 매 렌더 `[]`를 넘기면 재생 훅의 의존성이 바뀌어 매번 reset되어 애니메이션이 동작하지 않음 */
const EMPTY_NANGU_OBJECT_PATH_POINTS: NanguPathPoint[] = [];

export type SolutionPathEditorPresentation = "overlay" | "noteBallPlacementFullscreen";

export type SolutionPathEditorFullscreenProps = {
  variant: "nangu" | "trouble";
  /** trouble: 이미지 배치만 있을 때 null + layoutImageUrl */
  ballPlacement: NanguBallPlacement | null;
  /** ballPlacement 가 null 일 때(난구 이미지 원본) */
  layoutImageUrl?: string | null;
  /** 열릴 때 스냅샷 (부모 key로 리마운트 시 초기화) */
  initialPathPoints: NanguPathPoint[];
  initialObjectPathPoints: NanguPathPoint[];
  thicknessOffsetX: number;
  isBankShot: boolean;
  ballSpeed: BallSpeed;
  onConfirm: (payload: { pathPoints: NanguPathPoint[]; objectPathPoints: NanguPathPoint[] }) => void;
  onCancel: () => void;
  /**
   * overlay: z-[200] 일반 모달.
   * noteBallPlacementFullscreen: 당구노트 공배치 전체화면과 동일 셸(z-[9999]·safe-area·하단 네비 숨김).
   */
  presentation?: SolutionPathEditorPresentation;
  /**
   * true: 공 좌표·수구는 데이터 그대로(캔버스는 이미 읽기 전용). 상단「수구」변경만 비활성.
   * 난구해법 등 문제에 고정된 배치를 쓸 때.
   */
  readOnlyCueAndBalls?: boolean;
};

export function SolutionPathEditorFullscreen({
  variant,
  ballPlacement,
  layoutImageUrl = null,
  initialPathPoints,
  initialObjectPathPoints,
  thicknessOffsetX,
  isBankShot,
  ballSpeed,
  onConfirm,
  onCancel,
  presentation = "overlay",
  readOnlyCueAndBalls = false,
}: SolutionPathEditorFullscreenProps) {
  if (variant === "nangu" && !ballPlacement) {
    throw new Error("SolutionPathEditorFullscreen: nangu variant requires ballPlacement");
  }
  const [pathPoints, setPathPoints] = useState<NanguPathPoint[]>(initialPathPoints);
  const [objectPathPoints, setObjectPathPoints] = useState<NanguPathPoint[]>(initialObjectPathPoints);
  const [pathMode, setPathMode] = useState(true);
  const [objectPathMode, setObjectPathMode] = useState(false);
  /**
   * 난구(trouble): 수구경로 / 1적구경로 — 동시 활성 불가, 동시 비활성 가능(이때 경로선 추가 불가).
   * nangu는 기존 pathMode·objectPathMode만 사용.
   */
  const [troublePathEditLayer, setTroublePathEditLayer] = useState<"cue" | "object" | null>("cue");
  const [pathAddStack, setPathAddStack] = useState<Array<"cue" | "object">>([]);
  /** overlay 모드만 공 탭 시 줌 초점 이동. note 셸은 당구노트 공배치와 같이 플레이필드 중심 고정(테이블이 공을 쫓아 움직이지 않음) */
  const [zoomFocusOverlay, setZoomFocusOverlay] = useState({
    x: DEFAULT_TABLE_WIDTH / 2,
    y: DEFAULT_TABLE_HEIGHT / 2,
  });
  const zoomCtxRef = useRef<SolutionTableZoomContextValue | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomShellApiRef = useRef<SolutionTableZoomShellApi | null>(null);

  const isNoteShell = presentation === "noteBallPlacementFullscreen";
  const ballPlacementFullscreen = useBallPlacementFullscreen();
  const deviceOrientation = useTableOrientation();
  /** PC·태블릿(넓은 뷰포트): 모바일 가로만 제외하고 긴 변 세로 테이블과 동일하게 맞춤 */
  const [viewportMdUp, setViewportMdUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setViewportMdUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  /** 노트 셸: 우측 슬라이드(당구노트 공배치와 동일 위치) — 경로 삭제·애니메이션·보기 설정 */
  const [leftPathDrawerOpen, setLeftPathDrawerOpen] = useState(false);
  /** 난구(trouble): 우측 패널을 드래그로 닫기 — 열림 기준 오른쪽으로 밀린 px(0=완전히 열림) */
  const [troubleDrawerDragPx, setTroubleDrawerDragPx] = useState(0);
  const [troubleDrawerDragging, setTroubleDrawerDragging] = useState(false);
  const troubleDrawerAsideRef = useRef<HTMLElement | null>(null);
  const troubleDrawerDragRef = useRef<{ startX: number; basePx: number } | null>(null);
  const troubleDrawerDragPxRef = useRef(0);

  useEffect(() => {
    troubleDrawerDragPxRef.current = troubleDrawerDragPx;
  }, [troubleDrawerDragPx]);

  useEffect(() => {
    setTroubleDrawerDragPx(0);
  }, [leftPathDrawerOpen]);
  const [tableGridOn, setTableGridOn] = useState(true);
  const [tableDrawStyle, setTableDrawStyle] = useState<TableDrawStyle>("realistic");
  const [cueSpotOn, setCueSpotOn] = useState(true);
  const [cueBallChoice, setCueBallChoice] = useState<"white" | "yellow">(
    ballPlacement?.cueBall ?? "white"
  );
  const [cuePickerOpen, setCuePickerOpen] = useState(false);

  useEffect(() => {
    if (ballPlacement?.cueBall) setCueBallChoice(ballPlacement.cueBall);
  }, [ballPlacement?.cueBall]);

  /** 좌표 배치가 있을 때 수구 표시 — readOnly면 게시물/문제의 cueBall 고정 */
  const layoutForCue = useMemo((): NanguBallPlacement | null => {
    if (!ballPlacement) return null;
    if (readOnlyCueAndBalls) return ballPlacement;
    return { ...ballPlacement, cueBall: cueBallChoice };
  }, [ballPlacement, cueBallChoice, readOnlyCueAndBalls]);

  /**
   * 노트 셸: 테이블 긴 변 세로 — 기기 세로 모드이거나 PC/태블릿(768px 이상)일 때.
   * 좁은 화면에서만 가로(landscape) 뷰포트면 긴 변 가로 유지.
   */
  const effectivePortrait =
    isNoteShell && (deviceOrientation === "portrait" || viewportMdUp);
  const noteShellTableOrientation: TableOrientation = effectivePortrait ? "portrait" : "landscape";
  const tableCanvasW = effectivePortrait ? DEFAULT_TABLE_HEIGHT : DEFAULT_TABLE_WIDTH;
  const tableCanvasH = effectivePortrait ? DEFAULT_TABLE_WIDTH : DEFAULT_TABLE_HEIGHT;
  const pointerRect = useMemo(
    () =>
      effectivePortrait
        ? getPlayfieldRect(DEFAULT_TABLE_HEIGHT, DEFAULT_TABLE_WIDTH)
        : getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    [effectivePortrait]
  );

  const [playbackPathLinesVisible, setPlaybackPathLinesVisible] = useState(true);
  const [playbackGridVisible, setPlaybackGridVisible] = useState(true);
  const [playbackDrawStyle, setPlaybackDrawStyle] = useState<TableDrawStyle>("realistic");

  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);
  const layoutSrc =
    !ballPlacement && layoutImageUrl ? sanitizeImageSrc(layoutImageUrl) : null;
  const cuePos = layoutForCue
    ? layoutForCue.cueBall === "yellow"
      ? layoutForCue.yellowBall
      : layoutForCue.whiteBall
    : { x: 0.5, y: 0.5 };
  /** 수구 제외 1목 후보 2구 — 첫 스팟 스냅용 좌표 */
  const firstObjectSnapCandidates = useMemo((): { x: number; y: number }[] | null => {
    if (!layoutForCue) return null;
    return getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y }));
  }, [layoutForCue]);

  /**
   * 수구 경로 첫 스팟이 있으면 광선 충돌점. 없으면 수구에 가장 가까운 1목 후보 공의 원주(수구 방향) — 1목 경로만 먼저 그릴 때 사용.
   */
  const cueToFirstObjectHit = useMemo(() => {
    if (!layoutForCue) return null;
    if (pathPoints.length >= 1) {
      return cueFirstObjectHitFromBallPlacement(cuePos, pathPoints[0], layoutForCue, rect);
    }
    const nonCue = getNonCueBallNorms(layoutForCue);
    if (nonCue.length === 0) return null;
    let nearest = nonCue[0]!;
    let bestD = Infinity;
    for (const b of nonCue) {
      const d = distanceNormPointsInPlayfieldPx(cuePos, { x: b.x, y: b.y }, rect);
      if (d < bestD) {
        bestD = d;
        nearest = b;
      }
    }
    const collision = ballCircumferenceNormFacingApproach(
      { x: nearest.x, y: nearest.y },
      cuePos,
      rect
    );
    return { collision, objectKey: nearest.key };
  }, [layoutForCue, pathPoints, cuePos, rect]);
  const collisionNorm = cueToFirstObjectHit?.collision ?? null;

  const getNormalizedFromEvent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const z = zoomCtxRef.current;
      if (!z) return null;
      const cp = z.viewportClientToCanvasPx(clientX, clientY);
      if (!cp || !isInsidePlayfield(cp.x, cp.y, pointerRect)) return null;
      const vn = pixelToNormalized(cp.x, cp.y, pointerRect);
      return effectivePortrait ? portraitToLandscapeNorm(vn.x, vn.y) : vn;
    },
    [pointerRect, effectivePortrait]
  );

  /** 플레이필드 안 = norm · 쿠션/프레임 = 캔버스 px (반직선으로 쿠션선·목적구 둘레 스팟) */
  const getPointerAimFromEvent = useCallback(
    (clientX: number, clientY: number): PathPointerAim | null => {
      const z = zoomCtxRef.current;
      if (!z) return null;
      const cp = z.viewportClientToCanvasPx(clientX, clientY);
      if (!cp) return null;
      if (cp.x < -2 || cp.y < -2 || cp.x > tableCanvasW + 2 || cp.y > tableCanvasH + 2) return null;
      if (isInsidePlayfield(cp.x, cp.y, pointerRect)) {
        const vn = pixelToNormalized(cp.x, cp.y, pointerRect);
        const land = effectivePortrait ? portraitToLandscapeNorm(vn.x, vn.y) : vn;
        return { kind: "playfield", norm: land };
      }
      return { kind: "tableCanvas", cx: cp.x, cy: cp.y };
    },
    [pointerRect, effectivePortrait, tableCanvasW, tableCanvasH]
  );

  const rayAppendCtx = useMemo((): CuePathRayAppendContext => {
    return {
      cueLandscape: cuePos,
      canvasW: tableCanvasW,
      canvasH: tableCanvasH,
      portrait: effectivePortrait,
      collisionRectLandscape: rect,
      ballPlacement: layoutForCue,
    };
  }, [cuePos, tableCanvasW, tableCanvasH, effectivePortrait, rect, layoutForCue]);

  const playfieldCenterCanvas = useMemo(() => {
    const r = pointerRect;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [pointerRect]);

  const zoomFocus = isNoteShell ? playfieldCenterCanvas : zoomFocusOverlay;

  useEffect(() => {
    if (isNoteShell) return;
    setZoomFocusOverlay(playfieldCenterCanvas);
  }, [isNoteShell, playfieldCenterCanvas]);

  const cuePathSnapFn: CuePathSnapFn = useCallback(
    (x, y, ctx) => snapCuePathTap(x, y, firstObjectSnapCandidates, { ...ctx, cueNorm: cuePos }),
    [firstObjectSnapCandidates, cuePos]
  );

  const newCueSpotId = useCallback(
    () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const runCueAppend = useCallback(
    (norm: { x: number; y: number }) => {
      setPathPoints((prev) => {
        const r = appendCuePathPlayfieldWithAutoCushion(prev, norm, cuePathSnapFn, newCueSpotId, rayAppendCtx);
        if (!r.ok) {
          return prev;
        }
        const nAdded = r.points.length - prev.length;
        queueMicrotask(() =>
          setPathAddStack((s) => [...s, ...Array.from({ length: nAdded }, () => "cue" as const)])
        );
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId, rayAppendCtx]
  );

  const runCueAppendAim = useCallback(
    (aim: PathPointerAim) => {
      const dupThresholdPx = 14;
      setPathPoints((prev) => {
        const r = appendCuePathSpotWithAim(prev, aim, cuePathSnapFn, newCueSpotId, rayAppendCtx);
        if (!r.ok) {
          return prev;
        }
        const newSlice = r.points.slice(prev.length);
        const isDup = newSlice.some((added) =>
          prev.some(
            (p) =>
              distanceNormPointsInPlayfieldPx({ x: added.x, y: added.y }, { x: p.x, y: p.y }, rect) <
              dupThresholdPx
          )
        );
        if (isDup) return prev;
        const nAdded = newSlice.length;
        queueMicrotask(() =>
          setPathAddStack((s) => [...s, ...Array.from({ length: nAdded }, () => "cue" as const)])
        );
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId, rayAppendCtx, rect]
  );

  const addObjectPathPoint = useCallback(
    (norm: { x: number; y: number }, type?: "ball" | "cushion" | "free") => {
      const newId = () => `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setObjectPathPoints((prev) => {
        if (type != null) {
          queueMicrotask(() => setPathAddStack((s) => [...s, "object"]));
          return [...prev, { id: newId(), x: norm.x, y: norm.y, type }];
        }
        if (!layoutForCue || !collisionNorm) {
          const snapped = snapToPlayfieldCushionJunction(norm.x, norm.y);
          queueMicrotask(() => setPathAddStack((s) => [...s, "object"]));
          return [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type }];
        }
        const last = prev.length > 0 ? prev[prev.length - 1]! : null;
        const fromForSnap = last ?? collisionNorm;
        /** 직전 스팟이 쿠션이 아니면: 연장선의 쿠션 교차 → 탭 스냅 스팟 */
        if (last && last.type !== "cushion") {
          const aimCanvasPx = landscapeNormToPlayfieldCanvasPx(
            norm,
            tableCanvasW,
            tableCanvasH,
            effectivePortrait
          );
          const cushionHit = resolveObjectPathRayHitLandscape({
            fromLandscape: { x: last.x, y: last.y },
            aimCanvasPx,
            canvasW: tableCanvasW,
            canvasH: tableCanvasH,
            portrait: effectivePortrait,
            collisionRectLandscape: rect,
            ballPlacement: layoutForCue,
            allowNonCueBallCircle: false,
          });
          if (cushionHit && cushionHit.type === "cushion") {
            const maxAutoPx = playfieldGridOneCellEdgePx(rect, effectivePortrait);
            const distToCushion = distanceNormPointsInPlayfieldPx(
              { x: last.x, y: last.y },
              { x: cushionHit.x, y: cushionHit.y },
              rect
            );
            if (distToCushion <= maxAutoPx) {
              const snapped = snapObjectPathPlayfieldTap(
                norm.x,
                norm.y,
                { x: cushionHit.x, y: cushionHit.y },
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
              const id1 = newId();
              const id2 = newId();
              queueMicrotask(() => setPathAddStack((s) => [...s, "object", "object"]));
              return [
                ...prev,
                { id: id1, x: cushionHit.x, y: cushionHit.y, type: "cushion" },
                { id: id2, x: snapped.x, y: snapped.y, type: snapped.type },
              ];
            }
          }
        }
        const snapped = snapObjectPathPlayfieldTap(
          norm.x,
          norm.y,
          fromForSnap,
          getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
          rect
        );
        queueMicrotask(() => setPathAddStack((s) => [...s, "object"]));
        return [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type }];
      });
    },
    [layoutForCue, collisionNorm, rect, tableCanvasW, tableCanvasH, effectivePortrait]
  );

  const moveObjectPathPoint = useCallback(
    (id: string, norm: { x: number; y: number }) => {
      setObjectPathPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        if (!isLastSegmentEndpointSpotIndex(prev, idx)) return prev;
        const snapped =
          !layoutForCue || !collisionNorm
            ? snapToPlayfieldCushionJunction(norm.x, norm.y)
            : snapObjectPathPlayfieldTap(
                norm.x,
                norm.y,
                idx === 0 ? collisionNorm : prev[idx - 1]!,
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
        return prev.map((p) => (p.id === id ? { ...p, x: snapped.x, y: snapped.y, type: snapped.type } : p));
      });
    },
    [layoutForCue, collisionNorm, rect]
  );

  const removeObjectPathPoint = useCallback((id: string) => {
    setObjectPathPoints((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      if (!isLastSegmentEndpointSpotIndex(prev, idx)) return prev;
      queueMicrotask(() => setPathAddStack([]));
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const insertObjectPathPointBetween = useCallback(
    (segmentIndex: number, norm: { x: number; y: number }) => {
      if (!layoutForCue || !collisionNorm) return;
      const chain: { x: number; y: number }[] = [
        collisionNorm,
        ...objectPathPoints.map((p) => ({ x: p.x, y: p.y })),
      ];
      const fromNorm = chain[segmentIndex];
      if (!fromNorm) return;
      const snapped = snapObjectPathPlayfieldTap(
        norm.x,
        norm.y,
        fromNorm,
        getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
        rect
      );
      const newPoint: NanguPathPoint = {
        id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: snapped.x,
        y: snapped.y,
        type: snapped.type,
      };
      setObjectPathPoints((prev) => {
        const next = [...prev];
        next.splice(segmentIndex, 0, newPoint);
        queueMicrotask(() => setPathAddStack((s) => [...s, "object"]));
        return next;
      });
    },
    [collisionNorm, layoutForCue, objectPathPoints, rect]
  );

  const addObjectPathAim = useCallback(
    (aim: PathPointerAim) => {
      if (!layoutForCue || !collisionNorm) return;
      const dupThresholdPx = 14;
      const newId = () => `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (aim.kind === "playfield") {
        addObjectPathPoint(aim.norm);
        return;
      }
      setObjectPathPoints((prev) => {
        const from =
          prev.length > 0
            ? {
                x: prev[prev.length - 1]!.x,
                y: prev[prev.length - 1]!.y,
              }
            : collisionNorm;
        const last = prev.length > 0 ? prev[prev.length - 1]! : null;

        /** 직전이 쿠션이 아닐 때: 쿠션-only 교차 → 클램프 탭 스냅 (수구 경로와 동일) */
        if (last && last.type !== "cushion") {
          const cushionOnly = resolveObjectPathRayHitLandscape({
            fromLandscape: from,
            aimCanvasPx: { x: aim.cx, y: aim.cy },
            canvasW: tableCanvasW,
            canvasH: tableCanvasH,
            portrait: effectivePortrait,
            collisionRectLandscape: rect,
            ballPlacement: layoutForCue,
            allowNonCueBallCircle: false,
          });
          if (cushionOnly && cushionOnly.type === "cushion") {
            const maxAutoPx = playfieldGridOneCellEdgePx(rect, effectivePortrait);
            const distToCushion = distanceNormPointsInPlayfieldPx(
              from,
              { x: cushionOnly.x, y: cushionOnly.y },
              rect
            );
            if (distToCushion <= maxAutoPx) {
              const tapNorm = tableCanvasClampedToPlayfieldLandscapeNorm(
                aim.cx,
                aim.cy,
                tableCanvasW,
                tableCanvasH,
                effectivePortrait
              );
              const snapped = snapObjectPathPlayfieldTap(
                tapNorm.x,
                tapNorm.y,
                { x: cushionOnly.x, y: cushionOnly.y },
                getNonCueBallNorms(layoutForCue).map(({ x, y }) => ({ x, y })),
                rect
              );
              const newPoints: NanguPathPoint[] = [
                { id: newId(), x: cushionOnly.x, y: cushionOnly.y, type: "cushion" },
                { id: newId(), x: snapped.x, y: snapped.y, type: snapped.type },
              ];
              const isDup = newPoints.some((added) =>
                prev.some(
                  (p) =>
                    distanceNormPointsInPlayfieldPx({ x: added.x, y: added.y }, { x: p.x, y: p.y }, rect) <
                    dupThresholdPx
                )
              );
              if (isDup) return prev;
              queueMicrotask(() =>
                setPathAddStack((s) => [...s, "object" as const, "object" as const])
              );
              return [...prev, ...newPoints];
            }
          }
        }

        const hit = resolveObjectPathRayHitLandscape({
          fromLandscape: from,
          aimCanvasPx: { x: aim.cx, y: aim.cy },
          canvasW: tableCanvasW,
          canvasH: tableCanvasH,
          portrait: effectivePortrait,
          collisionRectLandscape: rect,
          ballPlacement: layoutForCue,
          allowNonCueBallCircle:
            prev.length === 0 || prev[prev.length - 1]?.type === "cushion",
          excludeBallKeys:
            cueToFirstObjectHit && prev.length === 0 ? [cueToFirstObjectHit.objectKey] : undefined,
        });
        if (!hit) {
          return prev;
        }
        const isDup =
          prev.length > 0 &&
          prev.some(
            (p) =>
              distanceNormPointsInPlayfieldPx({ x: hit.x, y: hit.y }, { x: p.x, y: p.y }, rect) <
              dupThresholdPx
          );
        if (isDup) return prev;
        queueMicrotask(() => setPathAddStack((s) => [...s, "object"]));
        return [
          ...prev,
          {
            id: newId(),
            x: hit.x,
            y: hit.y,
            type: hit.type,
          },
        ];
      });
    },
    [
      collisionNorm,
      cueToFirstObjectHit,
      layoutForCue,
      tableCanvasW,
      tableCanvasH,
      effectivePortrait,
      rect,
      addObjectPathPoint,
    ]
  );

  const insertObjectPathPointBetweenAim = useCallback(
    (segmentIndex: number, aim: PathPointerAim) => {
      if (!layoutForCue || !collisionNorm) return;
      if (aim.kind === "playfield") {
        insertObjectPathPointBetween(segmentIndex, aim.norm);
        return;
      }
      const chain: { x: number; y: number }[] = [
        collisionNorm,
        ...objectPathPoints.map((p) => ({ x: p.x, y: p.y })),
      ];
      const from = chain[segmentIndex];
      if (!from) return;
      const hit = resolveObjectPathRayHitLandscape({
        fromLandscape: from,
        aimCanvasPx: { x: aim.cx, y: aim.cy },
        canvasW: tableCanvasW,
        canvasH: tableCanvasH,
        portrait: effectivePortrait,
        collisionRectLandscape: rect,
        ballPlacement: layoutForCue,
        allowNonCueBallCircle:
          segmentIndex === 0 || objectPathPoints[segmentIndex - 1]?.type === "cushion",
        excludeBallKeys:
          cueToFirstObjectHit && segmentIndex === 0 ? [cueToFirstObjectHit.objectKey] : undefined,
      });
      if (!hit) {
        return;
      }
      const newPoint: NanguPathPoint = {
        id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: hit.x,
        y: hit.y,
        type: hit.type,
      };
      setObjectPathPoints((prev) => {
        const next = [...prev];
        next.splice(segmentIndex, 0, newPoint);
        queueMicrotask(() => setPathAddStack((s) => [...s, "object"]));
        return next;
      });
    },
    [
      collisionNorm,
      cueToFirstObjectHit,
      layoutForCue,
      objectPathPoints,
      tableCanvasW,
      tableCanvasH,
      effectivePortrait,
      rect,
      insertObjectPathPointBetween,
    ]
  );

  const cuePathEditing =
    variant === "trouble" ? troublePathEditLayer === "cue" : pathMode;
  const objectPathEditing =
    variant === "trouble" ? troublePathEditLayer === "object" : false;

  const pathPlayback = useSolutionPathPlayback({
    ballPlacement: layoutForCue,
    pathPoints,
    objectPathPoints: variant === "trouble" ? objectPathPoints : EMPTY_NANGU_OBJECT_PATH_POINTS,
    ballSpeed,
    isBankShot,
    thicknessOffsetX,
    /** 1목 경로 그리기 모드 + 스팟 1개 이상일 때만 재생 충돌 팝업 */
    collisionWarningsEnabled:
      variant === "trouble" && objectPathEditing && objectPathPoints.length >= 1,
  });

  const allowCuePlaybackGestures =
    isNoteShell && Boolean(layoutForCue && pathPoints.length >= 1 && !pathPlayback.isPlaybackActive);

  const wasPlaybackActiveRef = useRef(false);
  useEffect(() => {
    const now = pathPlayback.isPlaybackActive;
    if (now && !wasPlaybackActiveRef.current) {
      setPlaybackPathLinesVisible(true);
      setPlaybackGridVisible(true);
      /** 단순보기에서도 재생 시 동일 스타일 유지 */
      setPlaybackDrawStyle(tableDrawStyle);
    }
    wasPlaybackActiveRef.current = now;
  }, [pathPlayback.isPlaybackActive, tableDrawStyle]);

  useEffect(() => {
    if (!isNoteShell) return;
    ballPlacementFullscreen?.setFullscreen(true);
    return () => {
      ballPlacementFullscreen?.setFullscreen(false);
    };
  }, [isNoteShell, ballPlacementFullscreen]);

  useEffect(() => {
    if (!isNoteShell) return;
    if (variant === "trouble") {
      setTroublePathEditLayer("cue");
    } else {
      setPathMode(true);
      setObjectPathMode(false);
    }
  }, [isNoteShell, variant]);

  const { resetPlayback: resetPathPlayback } = pathPlayback;

  const clearAllPaths = useCallback(() => {
    resetPathPlayback();
    setPathAddStack([]);
    setPathPoints([]);
    setObjectPathPoints([]);
    if (variant === "trouble") {
      setTroublePathEditLayer("cue");
    } else {
      setObjectPathMode(false);
      setPathMode(true);
    }
  }, [resetPathPlayback, variant]);

  const undoLastPathSpot = useCallback(() => {
    setPathAddStack((stack) => {
      if (stack.length === 0) return stack;
      const kind = stack[stack.length - 1];
      const next = stack.slice(0, -1);
      queueMicrotask(() => {
        if (kind === "cue") {
          setPathPoints((prev) => stripInvalidEndSpots(prev.slice(0, -1)));
        } else {
          setObjectPathPoints((prev) => prev.slice(0, -1));
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (pathPoints.length === 0) {
      setObjectPathPoints([]);
      setPathAddStack([]);
      if (variant === "trouble") {
        setTroublePathEditLayer("cue");
      } else {
        setObjectPathMode(false);
        setPathMode(true);
      }
    }
  }, [pathPoints.length, variant]);

  const movePathPoint = useCallback(
    (id: string, norm: { x: number; y: number }) => {
      setPathPoints((prev) => moveCuePathSpotById(prev, id, norm, cuePathSnapFn));
    },
    [cuePathSnapFn]
  );

  const removePathPoint = useCallback((id: string) => {
    setPathAddStack([]);
    setPathPoints((prev) => stripInvalidEndSpots(prev.filter((p) => p.id !== id)));
  }, []);

  const insertPathPointBetween = useCallback(
    (segmentIndex: number, norm: { x: number; y: number }) => {
      setPathPoints((prev) => {
        const r = insertCuePathSpot(prev, segmentIndex, norm, cuePathSnapFn, newCueSpotId);
        if (!r.ok) {
          return prev;
        }
        queueMicrotask(() => setPathAddStack((s) => [...s, "cue"]));
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId]
  );

  const insertPathPointBetweenAim = useCallback(
    (segmentIndex: number, aim: PathPointerAim) => {
      setPathPoints((prev) => {
        const r = insertCuePathSpotWithAim(prev, segmentIndex, aim, cuePathSnapFn, newCueSpotId, rayAppendCtx);
        if (!r.ok) {
          return prev;
        }
        queueMicrotask(() => setPathAddStack((s) => [...s, "cue"]));
        return r.points;
      });
    },
    [cuePathSnapFn, newCueSpotId, rayAppendCtx]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isNoteShell && leftPathDrawerOpen) {
        e.preventDefault();
        setLeftPathDrawerOpen(false);
        return;
      }
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, isNoteShell, leftPathDrawerOpen]);

  const endTroubleDrawerDrag = useCallback((e: React.PointerEvent) => {
    if (!isNoteShell) return;
    troubleDrawerDragRef.current = null;
    setTroubleDrawerDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const w = troubleDrawerAsideRef.current?.offsetWidth ?? 180;
    const threshold = Math.min(72, w * 0.25);
    setTroubleDrawerDragPx((px) => {
      if (px >= threshold) {
        queueMicrotask(() => setLeftPathDrawerOpen(false));
      }
      return 0;
    });
  }, [isNoteShell]);

  const onTroubleDrawerHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell) return;
      e.preventDefault();
      troubleDrawerDragRef.current = {
        startX: e.clientX,
        basePx: troubleDrawerDragPxRef.current,
      };
      setTroubleDrawerDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isNoteShell]
  );

  const onTroubleDrawerHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isNoteShell || !troubleDrawerDragRef.current) return;
      const w = troubleDrawerAsideRef.current?.offsetWidth ?? 180;
      const { startX, basePx } = troubleDrawerDragRef.current;
      const dx = e.clientX - startX;
      const next = Math.max(0, Math.min(basePx + dx, w));
      setTroubleDrawerDragPx(next);
    },
    [variant]
  );

  const C = TROUBLE_SOLUTION_CONSOLE;
  const showObjectPath = variant === "trouble";

  const panPointerPolicy = useMemo((): SolutionTablePanPointerPolicy => {
    const ballPickLayout =
      layoutForCue && (cuePathEditing || objectPathEditing) ? layoutForCue : undefined;
    const ballNormOverrides = pathPlayback.ballNormOverrides ?? undefined;
    const objectPts = showObjectPath ? objectPathPoints : [];
    const objMode = objectPathEditing;

    const classifyAt = (clientX: number, clientY: number) => {
      const norm = getNormalizedFromEvent(clientX, clientY);
      if (!norm) return null;
      return classifySolutionPathPointerHit({
        norm,
        pathMode: cuePathEditing,
        objectPathMode: objMode,
        cuePos,
        pathPoints,
        objectPathPoints: objectPts,
        ballPickLayout,
        collisionLayout: layoutForCue ?? null,
        ballNormOverrides,
        width: DEFAULT_TABLE_WIDTH,
        height: DEFAULT_TABLE_HEIGHT,
        allowCuePlaybackGestures,
      });
    };

    return {
      isEmptyForPan: (clientX, clientY, target) => {
        if (target instanceof Element) {
          if (target.closest("[data-solution-table-zoom-controls]")) return false;
          if (target.closest("[data-path-fs-drawer-drag]")) return false;
          if (isNoteShell && target.closest("[data-path-editor-fs-chrome]")) return false;
        }
        const c = classifyAt(clientX, clientY);
        return c != null && isClassificationEmptyForPan(c);
      },
      onEmptyTap: (clientX, clientY) => {
        const aimMargin = getPointerAimFromEvent(clientX, clientY);
        if (aimMargin?.kind === "tableCanvas") {
          if (cuePathEditing) runCueAppendAim(aimMargin);
          else if (objMode && collisionNorm) addObjectPathAim(aimMargin);
          return;
        }
        const c = classifyAt(clientX, clientY);
        if (!c) return;
        if (c.kind === "emptyCue" || c.kind === "pathObjectBallTap") {
          const norm = getNormalizedFromEvent(clientX, clientY);
          if (!norm) return;
          const dupThresholdPx = 14;
          if (
            !cuePathAppendWouldDuplicateExistingSpot(pathPoints, norm, rect, dupThresholdPx)
          ) {
            runCueAppend(norm);
          }
        } else if (c.kind === "emptyObject") {
          const norm = getNormalizedFromEvent(clientX, clientY);
          if (!norm || !collisionNorm) return;
          const dupThresholdPx = 14;
          const isDup =
            objectPathPoints.length > 0 &&
            objectPathPoints.some(
              (p) =>
                distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) < dupThresholdPx
            );
          if (!isDup) addObjectPathPoint(norm);
        }
      },
    };
  }, [
    layoutForCue,
    cuePathEditing,
    objectPathEditing,
    showObjectPath,
    pathPlayback.ballNormOverrides,
    getNormalizedFromEvent,
    getPointerAimFromEvent,
    cuePos,
    pathPoints,
    objectPathPoints,
    runCueAppend,
    runCueAppendAim,
    addObjectPathPoint,
    addObjectPathAim,
    collisionNorm,
    isNoteShell,
    rect,
    allowCuePlaybackGestures,
  ]);

  const rootClass = isNoteShell
    ? "fixed inset-0 z-[9999] flex flex-col bg-site-bg text-site-text"
    : "fixed inset-0 z-[200] flex flex-col bg-site-bg text-site-text";

  const rootStyle: React.CSSProperties | undefined = isNoteShell
    ? {
        padding:
          "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      }
    : undefined;

  const gridVisibleForTable = pathPlayback.isPlaybackActive ? playbackGridVisible : tableGridOn;
  const drawStyleForTable = pathPlayback.isPlaybackActive ? playbackDrawStyle : tableDrawStyle;
  const showCueSpot =
    (isNoteShell ? cueSpotOn : true) && !pathPlayback.isPlaybackActive;

  /** 수구 광선으로 먼저 맞는 목적구(또는 첫 스팟 없을 때 가장 가까운 목적구) — 1목 출발 점선 링 */
  const objectPathHighlightBallKey = useMemo((): "red" | "yellow" | "white" | null => {
    if (!layoutForCue || !showObjectPath) return null;
    const nonCue = getNonCueBallNorms(layoutForCue);
    if (nonCue.length === 0) return null;
    if (pathPoints.length >= 1) {
      const hit = cueFirstObjectHitFromBallPlacement(cuePos, pathPoints[0], layoutForCue, rect);
      return hit?.objectKey ?? null;
    }
    let nearest = nonCue[0]!;
    let bestD = Infinity;
    for (const b of nonCue) {
      const d = distanceNormPointsInPlayfieldPx(cuePos, { x: b.x, y: b.y }, rect);
      if (d < bestD) {
        bestD = d;
        nearest = b;
      }
    }
    return nearest.key;
  }, [layoutForCue, showObjectPath, pathPoints, cuePos, rect]);

  const showObjectBallSpot =
    showCueSpot &&
    showObjectPath &&
    objectPathHighlightBallKey != null &&
    objectPathPoints.length >= 1;

  const toggleGrid = useCallback(() => {
    if (pathPlayback.isPlaybackActive) setPlaybackGridVisible((v) => !v);
    else setTableGridOn((v) => !v);
  }, [pathPlayback.isPlaybackActive]);

  const toggleDrawStyle = useCallback(() => {
    if (pathPlayback.isPlaybackActive) {
      setPlaybackDrawStyle((d) => (d === "realistic" ? "wireframe" : "realistic"));
    } else {
      setTableDrawStyle((d) => (d === "realistic" ? "wireframe" : "realistic"));
    }
  }, [pathPlayback.isPlaybackActive]);

  return (
    <div
      className={rootClass}
      style={rootStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="path-fs-title"
    >
      {isNoteShell ? (
        <div
          data-path-editor-fs-chrome=""
          className="w-full flex justify-center px-2 pt-2 z-[210] shrink-0 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <div className="w-full max-w-2xl flex items-center gap-1.5 sm:gap-2 min-h-9 pb-2">
            <h1 id="path-fs-title" className="sr-only">
              {variant === "nangu" ? "해법 경로 편집 전체화면" : "난구해법 경로 편집 전체화면"}
            </h1>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <button
                type="button"
                className="shrink-0 rounded-lg border border-gray-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 px-2.5 py-1.5 text-xs font-medium text-site-text touch-manipulation"
                onClick={onCancel}
              >
                취소
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {layoutForCue && (
              <button
                type="button"
                disabled={readOnlyCueAndBalls}
                onClick={() => {
                  if (!readOnlyCueAndBalls) setCuePickerOpen(true);
                }}
                title={
                  readOnlyCueAndBalls
                    ? "이 문제에 지정된 수구만 사용합니다 (변경 불가)"
                    : undefined
                }
                className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold border touch-manipulation ${
                  layoutForCue.cueBall === "yellow"
                    ? "border-amber-400/70 bg-amber-500/15 text-amber-900 dark:text-amber-200"
                    : "border-gray-300 dark:border-slate-600 bg-black/10 dark:bg-white/10 text-site-text"
                } ${readOnlyCueAndBalls ? "cursor-not-allowed opacity-60" : ""}`}
                aria-label={
                  readOnlyCueAndBalls ? "수구 (문제 지정, 변경 불가)" : "수구 변경"
                }
              >
                수구
              </button>
            )}
            {layoutForCue && (
              <button
                type="button"
                onClick={() => setCueSpotOn((v) => !v)}
                className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-semibold leading-tight border transition-colors touch-manipulation ${
                  cueSpotOn
                    ? "border-site-primary/60 bg-site-primary/15 text-site-primary"
                    : "border-gray-300 dark:border-slate-600 bg-black/10 dark:bg-white/10 text-site-text"
                }`}
                aria-pressed={cueSpotOn}
                aria-label={cueSpotOn ? "수구 확인 표시 끄기" : "수구 확인 표시 켜기"}
              >
                수구확인
                <br />
                <span className="tabular-nums">{cueSpotOn ? "ON" : "OFF"}</span>
              </button>
            )}
            {showObjectPath && layoutForCue && variant === "trouble" && (
              <>
                <button
                  type="button"
                  {...{ "data-trouble-action": C.action.togglePathMode }}
                  onClick={() =>
                    setTroublePathEditLayer((cur) => (cur === "cue" ? null : "cue"))
                  }
                  className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-semibold leading-tight border transition-colors touch-manipulation ${
                    cuePathEditing
                      ? "border-site-primary/70 bg-site-primary/15 text-site-primary"
                      : "border-gray-300 dark:border-slate-600 bg-black/10 dark:bg-white/10 text-site-text"
                  }`}
                  aria-pressed={cuePathEditing}
                  aria-label={cuePathEditing ? "수구경로 그리기 끄기" : "수구경로 그리기 켜기"}
                >
                  수구경로
                  <br />
                  <span className="tabular-nums">{cuePathEditing ? "ON" : "OFF"}</span>
                </button>
                <button
                  type="button"
                  {...{ "data-trouble-action": C.action.toggleObjectPathMode }}
                  onClick={() =>
                    setTroublePathEditLayer((cur) => (cur === "object" ? null : "object"))
                  }
                  className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-semibold leading-tight border transition-colors touch-manipulation ${
                    objectPathEditing
                      ? "border-sky-700 bg-sky-600/20 text-sky-900 dark:text-sky-100"
                      : "border-gray-300 dark:border-slate-600 bg-black/10 dark:bg-white/10 text-site-text"
                  }`}
                  aria-pressed={objectPathEditing}
                  aria-label={objectPathEditing ? "1적구경로 그리기 끄기" : "1적구경로 그리기 켜기"}
                >
                  1적구경로
                  <br />
                  <span className="tabular-nums">{objectPathEditing ? "ON" : "OFF"}</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="shrink-0 flex items-center gap-1 rounded-lg bg-site-primary px-2.5 py-1.5 text-xs font-medium text-white shadow touch-manipulation"
              onClick={() =>
                onConfirm({
                  pathPoints,
                  objectPathPoints: variant === "trouble" ? objectPathPoints : [],
                })
              }
            >
              <span>완료</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            </div>
          </div>
        </div>
      ) : (
        <header
          className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
        >
          <button
            type="button"
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-slate-600 touch-manipulation"
            onClick={onCancel}
          >
            취소
          </button>
          <h1 id="path-fs-title" className="text-base font-semibold truncate text-center flex-1 px-2">
            경로 편집
          </h1>
          <button
            type="button"
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-site-primary text-white touch-manipulation"
            onClick={() =>
              onConfirm({
                pathPoints,
                objectPathPoints: variant === "trouble" ? objectPathPoints : [],
              })
            }
          >
            완료
          </button>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isNoteShell && (
          <>
            <div
              data-path-editor-fs-chrome=""
              aria-hidden={!leftPathDrawerOpen}
              className={`fixed inset-0 z-[200] bg-black/30 transition-opacity duration-300 ease-out ${
                leftPathDrawerOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              }`}
              onClick={() => setLeftPathDrawerOpen(false)}
            />
            <aside
              ref={troubleDrawerAsideRef}
              data-path-editor-fs-chrome=""
              id="path-fs-right-drawer"
              aria-hidden={!leftPathDrawerOpen}
              className={`fixed right-0 top-0 z-[205] flex h-full w-[min(52.8vw,180px)] flex-col border-l border-white/20 bg-black/30 text-white shadow-[-6px_0_20px_rgba(0,0,0,0.25)] backdrop-blur-md ${
                leftPathDrawerOpen ? "pointer-events-auto" : "pointer-events-none translate-x-full"
              } ${troubleDrawerDragging ? "!duration-0" : "transition-transform duration-300 ease-out"}`}
              style={
                leftPathDrawerOpen
                  ? {
                      transform: `translateX(${troubleDrawerDragPx}px)`,
                      transition: troubleDrawerDragging ? "none" : undefined,
                    }
                  : undefined
              }
            >
              {leftPathDrawerOpen && (
                <div
                  data-path-fs-drawer-drag=""
                  aria-hidden
                  className="absolute left-0 top-0 z-10 h-full w-4 cursor-grab touch-none active:cursor-grabbing"
                  style={{ touchAction: "none" }}
                  onPointerDown={onTroubleDrawerHandlePointerDown}
                  onPointerMove={onTroubleDrawerHandlePointerMove}
                  onPointerUp={endTroubleDrawerDrag}
                  onPointerCancel={endTroubleDrawerDrag}
                />
              )}
              <div className="border-b border-white/15 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <h2 className="text-sm font-semibold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  경로 · 보기
                </h2>
              </div>
              <div
                className={`flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] min-h-0 ${
                  variant === "trouble" ? "justify-center" : ""
                }`}
              >
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">경로</p>
                <button
                  type="button"
                  {...(variant === "trouble" ? { "data-trouble-action": C.action.undoLastPathSpot } : {})}
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] disabled:opacity-45"
                  disabled={pathAddStack.length === 0 || pathPlayback.isPlaybackActive}
                  onClick={() => {
                    undoLastPathSpot();
                    setLeftPathDrawerOpen(false);
                  }}
                >
                  마지막 경로선 삭제
                </button>
                <button
                  type="button"
                  {...(variant === "trouble" ? { "data-trouble-action": C.action.clearAllPaths } : {})}
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] disabled:opacity-45"
                  disabled={
                    (pathPoints.length === 0 && objectPathPoints.length === 0) ||
                    pathPlayback.isPlaybackActive
                  }
                  onClick={() => {
                    clearAllPaths();
                    setLeftPathDrawerOpen(false);
                  }}
                >
                  전체 경로선 삭제
                </button>
                <button
                  type="button"
                  {...(variant === "trouble" ? { "data-trouble-action": C.action.playPath } : {})}
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] disabled:opacity-45"
                  disabled={!pathPlayback.canPlayback || pathPlayback.isPlaybackActive}
                  onClick={() => {
                    pathPlayback.startPlayback();
                    setLeftPathDrawerOpen(false);
                  }}
                >
                  애니메이션 보기
                  <span className="mt-0.5 block text-xs font-normal text-white/55">
                    재생 중에는 경로 편집이 잠깁니다
                  </span>
                </button>
                {pathPlayback.isPlaybackActive && (
                  <>
                    <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                      재생 중
                    </p>
                    <button
                      type="button"
                      className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                      onClick={() => setPlaybackPathLinesVisible(!playbackPathLinesVisible)}
                    >
                      {playbackPathLinesVisible ? "경로선 숨기기" : "경로선 보이기"}
                    </button>
                  </>
                )}
                <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">보기</p>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  onClick={() => {
                    toggleDrawStyle();
                    setLeftPathDrawerOpen(false);
                  }}
                >
                  {drawStyleForTable === "realistic" ? "단순보기로 전환" : "실사보기로 전환"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl px-4 py-3.5 text-left text-sm font-medium bg-black/25 hover:bg-black/35 active:bg-black/40 touch-manipulation drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                  onClick={() => {
                    toggleGrid();
                    setLeftPathDrawerOpen(false);
                  }}
                >
                  {gridVisibleForTable ? "그리드 숨기기" : "그리드 보이기"}
                </button>
              </div>
            </aside>
          </>
        )}
        <div
          className={`flex min-h-0 w-full flex-1 flex-col ${
            isNoteShell ? "items-stretch justify-center p-2" : ""
          }`}
        >
        <div
          className={
            isNoteShell
              ? "relative flex h-full min-h-0 w-full max-w-2xl min-w-0 flex-1 flex-col pt-2"
              : "relative mx-auto flex w-full max-w-4xl min-h-0 min-w-0 flex-1 flex-col px-2 pt-2"
          }
        >
          {isNoteShell && (
            <button
              type="button"
              data-path-editor-fs-chrome=""
              aria-label="경로 및 보기 메뉴 열기"
              aria-expanded={leftPathDrawerOpen}
              aria-controls="path-fs-right-drawer"
              onClick={() => setLeftPathDrawerOpen(true)}
              className="absolute right-0 top-[45.5%] z-[125] flex h-11 w-[1.215rem] -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-gray-300/60 bg-white/20 text-gray-800 shadow-md backdrop-blur-sm touch-manipulation hover:bg-white/30 active:bg-white/25 dark:border-slate-500/60 dark:bg-white/20 dark:text-gray-900"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 opacity-90"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <div
            className={
              isNoteShell
                ? "relative mx-auto w-full flex-1 min-h-[min(52dvh,620px)] max-h-[min(88dvh,820px)] min-w-0 cursor-crosshair touch-manipulation"
                : "relative mx-auto h-full max-h-[min(52vh,480px)] w-full cursor-crosshair touch-manipulation"
            }
            style={{ aspectRatio: `${tableCanvasW} / ${tableCanvasH}` }}
          >
            <SolutionTableZoomShell
              ref={containerRef}
              contentWidth={tableCanvasW}
              contentHeight={tableCanvasH}
              focusCanvasX={zoomFocus.x}
              focusCanvasY={zoomFocus.y}
              interactionLocked={pathPlayback.isPlaybackActive}
              panPointerPolicy={panPointerPolicy}
              zoomApiRef={zoomShellApiRef}
              forceShowZoomControls={!isNoteShell}
              fitMode="contain"
              panResetKey={isNoteShell ? noteShellTableOrientation : undefined}
              className="relative h-full w-full min-h-0 overflow-hidden rounded-lg border border-gray-200 dark:border-slate-600"
            >
              {(zoom) => {
                zoomCtxRef.current = zoom;
                return (
                  <>
                    <div className="absolute inset-0 w-full h-full">
                      {layoutForCue ? (
                        <NanguReadOnlyLayout
                          ballPlacement={layoutForCue}
                          showGrid={gridVisibleForTable}
                          drawStyle={drawStyleForTable}
                          fillContainer
                          embedFill
                          className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
                          hideObjectBall={false}
                          ballNormOverrides={pathPlayback.ballNormOverrides ?? undefined}
                          showCueBallSpot={showCueSpot}
                          showObjectBallSpot={showObjectBallSpot}
                          objectBallSpotKey={objectPathHighlightBallKey}
                          orientation={isNoteShell ? noteShellTableOrientation : "landscape"}
                          betweenTableAndBallsLayer={
                            <NanguSolutionPathOverlay
                              pathPoints={pathPoints}
                              cuePos={cuePos}
                              tableBallPlacement={layoutForCue}
                              objectPathPoints={showObjectPath ? objectPathPoints : []}
                              orientation={isNoteShell ? noteShellTableOrientation : "landscape"}
                              pathMode={cuePathEditing}
                              objectPathMode={objectPathEditing}
                              getNormalizedFromEvent={getNormalizedFromEvent}
                              getPointerAimFromEvent={getPointerAimFromEvent}
                              onZoomSetFocusCanvasPx={
                                isNoteShell ? undefined : (cx, cy) => setZoomFocusOverlay({ x: cx, y: cy })
                              }
                              ballPickLayout={
                                layoutForCue && (cuePathEditing || objectPathEditing)
                                  ? layoutForCue
                                  : undefined
                              }
                              ballNormOverrides={pathPlayback.ballNormOverrides ?? undefined}
                              onAddPoint={(norm) => {
                                const dupThresholdPx = 14;
                                if (
                                  !cuePathAppendWouldDuplicateExistingSpot(
                                    pathPoints,
                                    norm,
                                    rect,
                                    dupThresholdPx
                                  )
                                ) {
                                  runCueAppend(norm);
                                }
                              }}
                              onAddCuePathAim={runCueAppendAim}
                              onInsertCuePathAim={insertPathPointBetweenAim}
                              onRemovePoint={removePathPoint}
                              onMovePoint={movePathPoint}
                              onInsertBetween={insertPathPointBetween}
                              onAddObjectPoint={(norm) => {
                                if (!collisionNorm) return;
                                const dupThresholdPx = 14;
                                const isDup =
                                  objectPathPoints.length > 0 &&
                                  objectPathPoints.some(
                                    (p) =>
                                      distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) <
                                      dupThresholdPx
                                  );
                                if (!isDup) addObjectPathPoint(norm);
                              }}
                              onAddObjectPathAim={addObjectPathAim}
                              onRemoveObjectPoint={removeObjectPathPoint}
                              onMoveObjectPoint={moveObjectPathPoint}
                              onInsertObjectBetween={insertObjectPathPointBetween}
                              onInsertObjectPathAim={insertObjectPathPointBetweenAim}
                              pathLinesVisible={!pathPlayback.isPlaybackActive || playbackPathLinesVisible}
                              allowCuePlaybackGestures={allowCuePlaybackGestures}
                              onCueBallSingleTap={
                                allowCuePlaybackGestures ? () => resetPathPlayback() : undefined
                              }
                              onCueBallDoubleTap={
                                allowCuePlaybackGestures
                                  ? () => {
                                      if (!pathPlayback.canPlayback) return;
                                      resetPathPlayback();
                                      pathPlayback.startPlayback();
                                    }
                                  : undefined
                              }
                            />
                          }
                        />
                      ) : layoutSrc ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800">
                          <img
                            src={layoutSrc}
                            alt="원본 공배치"
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                          배치 없음
                        </div>
                      )}
                    </div>
                    {!layoutForCue && (
                      <NanguSolutionPathOverlay
                        pathPoints={pathPoints}
                        cuePos={cuePos}
                        objectPathPoints={showObjectPath ? objectPathPoints : []}
                        orientation={isNoteShell ? noteShellTableOrientation : "landscape"}
                        pathMode={cuePathEditing}
                        objectPathMode={objectPathEditing}
                        getNormalizedFromEvent={getNormalizedFromEvent}
                        getPointerAimFromEvent={getPointerAimFromEvent}
                        onZoomSetFocusCanvasPx={
                          isNoteShell ? undefined : (cx, cy) => setZoomFocusOverlay({ x: cx, y: cy })
                        }
                        ballNormOverrides={pathPlayback.ballNormOverrides ?? undefined}
                        onAddPoint={(norm) => {
                          const dupThresholdPx = 14;
                          if (
                            !cuePathAppendWouldDuplicateExistingSpot(
                              pathPoints,
                              norm,
                              rect,
                              dupThresholdPx
                            )
                          ) {
                            runCueAppend(norm);
                          }
                        }}
                        onAddCuePathAim={runCueAppendAim}
                        onInsertCuePathAim={insertPathPointBetweenAim}
                        onRemovePoint={removePathPoint}
                        onMovePoint={movePathPoint}
                        onInsertBetween={insertPathPointBetween}
                        onAddObjectPoint={(norm) => {
                          if (!collisionNorm) return;
                          const dupThresholdPx = 14;
                          const isDup =
                            objectPathPoints.length > 0 &&
                            objectPathPoints.some(
                              (p) =>
                                distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) <
                                dupThresholdPx
                            );
                          if (!isDup) addObjectPathPoint(norm);
                        }}
                        onAddObjectPathAim={addObjectPathAim}
                        onRemoveObjectPoint={removeObjectPathPoint}
                        onMoveObjectPoint={moveObjectPathPoint}
                        onInsertObjectBetween={insertObjectPathPointBetween}
                        onInsertObjectPathAim={insertObjectPathPointBetweenAim}
                        pathLinesVisible={!pathPlayback.isPlaybackActive || playbackPathLinesVisible}
                        allowCuePlaybackGestures={allowCuePlaybackGestures}
                        onCueBallSingleTap={
                          allowCuePlaybackGestures ? () => resetPathPlayback() : undefined
                        }
                        onCueBallDoubleTap={
                          allowCuePlaybackGestures
                            ? () => {
                                if (!pathPlayback.canPlayback) return;
                                resetPathPlayback();
                                pathPlayback.startPlayback();
                              }
                            : undefined
                        }
                      />
                    )}
                    <PathPlaybackViewOverlay
                      variant={variant === "trouble" ? "trouble" : "nangu"}
                      active={pathPlayback.isPlaybackActive}
                      pathLinesVisible={playbackPathLinesVisible}
                      onPathLinesVisibleChange={setPlaybackPathLinesVisible}
                      gridVisible={playbackGridVisible}
                      onGridVisibleChange={setPlaybackGridVisible}
                      drawStyle={playbackDrawStyle}
                      onDrawStyleChange={setPlaybackDrawStyle}
                    />
                  </>
                );
              }}
            </SolutionTableZoomShell>
          </div>
        </div>
        </div>

        {!isNoteShell && (
        <div
          className="shrink-0 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 space-y-2 overflow-y-auto max-h-[min(28vh,320px)] sm:max-h-[38vh]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          {...(variant === "trouble" ? { "data-trouble-region": C.region.pathToolbar } : {})}
        >
          <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">진행경로</span>
            {variant === "trouble" && showObjectPath && layoutForCue ? (
              <>
                <button
                  type="button"
                  {...{ "data-trouble-action": C.action.togglePathMode }}
                  onClick={() =>
                    setTroublePathEditLayer((cur) => (cur === "cue" ? null : "cue"))
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border touch-manipulation ${
                    cuePathEditing
                      ? "bg-site-primary text-white border-site-primary"
                      : "border-gray-300 dark:border-slate-600 text-site-text"
                  }`}
                  aria-pressed={cuePathEditing}
                  aria-label={cuePathEditing ? "수구경로 그리기 끄기" : "수구경로 그리기 켜기"}
                >
                  {cuePathEditing ? "수구경로 ON" : "수구경로 OFF"}
                </button>
                <button
                  type="button"
                  {...{ "data-trouble-action": C.action.toggleObjectPathMode }}
                  onClick={() =>
                    setTroublePathEditLayer((cur) => (cur === "object" ? null : "object"))
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border touch-manipulation ${
                    objectPathEditing
                      ? "bg-sky-700 text-white border-sky-700"
                      : "border-gray-300 dark:border-slate-600 text-site-text"
                  }`}
                  aria-pressed={objectPathEditing}
                  aria-label={objectPathEditing ? "1적구경로 그리기 끄기" : "1적구경로 그리기 켜기"}
                >
                  {objectPathEditing ? "1적구경로 ON" : "1적구경로 OFF"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPathMode((v) => {
                      const next = !v;
                      if (next) setObjectPathMode(false);
                      return next;
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border touch-manipulation ${
                    pathMode
                      ? "bg-site-primary text-white border-site-primary"
                      : "border-gray-300 dark:border-slate-600 text-site-text"
                  }`}
                >
                  {pathMode ? "수구 경로 입력 중" : "수구 경로 입력"}
                </button>
                {showObjectPath && layoutForCue && (
                  <button
                    type="button"
                    onClick={() => {
                      setObjectPathMode((v) => {
                        const next = !v;
                        if (next) setPathMode(false);
                        else setPathMode(true);
                        return next;
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border touch-manipulation ${
                      objectPathMode
                        ? "bg-sky-700 text-white border-sky-700"
                        : "border-gray-300 dark:border-slate-600 text-site-text"
                    }`}
                    aria-pressed={objectPathMode}
                    aria-label={
                      objectPathMode
                        ? "1목적구 경로선 그리기 끄기"
                        : "1목적구 경로선 그리기 켜기"
                    }
                  >
                    {objectPathMode ? "1목적구 경로선 그리는 중" : "1목적구 경로선 그리기"}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              {...(variant === "trouble" ? { "data-trouble-action": C.action.undoLastPathSpot } : {})}
              disabled={pathAddStack.length === 0 || pathPlayback.isPlaybackActive}
              onClick={() => undoLastPathSpot()}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-slate-600 disabled:opacity-50 touch-manipulation"
            >
              이전 스팟
            </button>
            <button
              type="button"
              {...(variant === "trouble" ? { "data-trouble-action": C.action.clearAllPaths } : {})}
              disabled={
                (pathPoints.length === 0 && objectPathPoints.length === 0) ||
                pathPlayback.isPlaybackActive
              }
              onClick={() => clearAllPaths()}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-600 disabled:opacity-50 touch-manipulation"
            >
              전체 삭제
            </button>
            <button
              type="button"
              {...(variant === "trouble" ? { "data-trouble-action": C.action.playPath } : {})}
              disabled={!pathPlayback.canPlayback || pathPlayback.isPlaybackActive}
              onClick={() => pathPlayback.startPlayback()}
              className="px-3 py-1.5 rounded-lg text-sm border border-amber-400 text-amber-800 bg-amber-50 dark:bg-amber-950/40 disabled:opacity-50 touch-manipulation"
            >
              {pathPlayback.isPlaybackActive ? "재생 중…" : "애니메이션 시연"}
            </button>
          </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              스팟·드래그·줌은 이 화면에서만 사용합니다.
              {variant === "trouble"
                ? " 난구: 「수구경로」「1적구경로」는 동시에 켤 수 없으며, 둘 다 끄면 경로선을 추가할 수 없습니다."
                : " 1목 경로는 수구보다 먼저 그려도 됩니다(스위치·애니메이션 시연은 수구 경로와 맞물릴 때만)."}
              완료 시 저장되고, 취소 시 들어오기 전 상태로 돌아갑니다.
            </p>
          </>
        </div>
        )}
      </div>

      {cuePickerOpen && layoutForCue && !readOnlyCueAndBalls && (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-transparent"
          aria-modal="true"
          role="dialog"
          aria-label="수구 선택"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            aria-label="닫기"
            onClick={() => setCuePickerOpen(false)}
          />
          <div className="relative z-[1] mx-4 flex flex-col items-center rounded-xl bg-transparent px-6 py-5">
            <p
              className="text-center text-base font-medium text-white mb-6"
              style={{
                textShadow: "0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.6)",
              }}
            >
              수구를 선택하세요
            </p>
            <div className="flex gap-8 justify-center">
              <button
                type="button"
                onClick={() => {
                  setCueBallChoice("white");
                  setCuePickerOpen(false);
                }}
                className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110 hover:border-white/40 ${
                  cueBallChoice === "white"
                    ? "border-site-primary ring-2 ring-site-primary/50"
                    : "border-white/20"
                }`}
                aria-label="흰공을 수구로"
              >
                <span
                  className="h-[60px] w-[60px] rounded-full bg-[#f8f8f8] shadow-inner block"
                  style={{
                    boxShadow:
                      "inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.15)",
                  }}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCueBallChoice("yellow");
                  setCuePickerOpen(false);
                }}
                className={`flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-110 hover:border-white/40 ${
                  cueBallChoice === "yellow"
                    ? "border-site-primary ring-2 ring-site-primary/50"
                    : "border-white/20"
                }`}
                aria-label="노란공을 수구로"
              >
                <span
                  className="h-[60px] w-[60px] rounded-full bg-[#f5d033] block"
                  style={{
                    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.25)",
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      <CollisionWarningToast
        variant="plain"
        message={pathPlayback.collisionMessage}
        onDismiss={pathPlayback.dismissCollisionMessage}
      />
    </div>
  );
}
